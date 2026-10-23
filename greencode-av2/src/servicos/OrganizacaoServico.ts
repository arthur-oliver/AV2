import { prisma } from '../lib/prisma';
import { OrganizacaoRepositorio } from '../repositorios/OrganizacaoRepositorio';
import { LoteRepositorio } from '../repositorios/LoteRepositorio';
import { EquipamentoRepositorio } from '../repositorios/EquipamentoRepositorio';
import { ValidadorCNPJ, somenteDigitos } from '../validadores/ValidadorCNPJ';
import { Conflito, ErroValidacao, NaoEncontrado, RegraNegocio } from '../erros/AppError';
import { lerPaginacao } from '../utils/paginacao';
import { registrarJournal } from '../utils/auditoria';
import { exigirAtualizacao } from '../utils/versao';

export interface DadosContrato {
  dataAssinatura?: string;
  dataVencimento: string;
  clausulas: string[];
  valorMensal: number;
  renovacaoAutomatica?: boolean;
}

export interface DadosOrganizacao {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual?: string;
  enderecoCompleto?: string;
  telefone?: string;
  email?: string;
  contrato?: DadosContrato;
}

export type DadosAtualizacao = Partial<Omit<DadosOrganizacao, 'cnpj' | 'contrato'>> & { versao: number };

function lerData(valor: string, campo: string): Date {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) throw new ErroValidacao(`Data inválida em "${campo}". Use o formato AAAA-MM-DD.`);
  return d;
}

// Converte os dados recebidos em dados prontos para o banco (e valida as datas).
function montarContrato(d: DadosContrato) {
  const assinatura = d.dataAssinatura ? lerData(d.dataAssinatura, 'dataAssinatura') : new Date();
  const vencimento = lerData(d.dataVencimento, 'dataVencimento');
  if (vencimento <= assinatura) throw new ErroValidacao('A data de vencimento deve ser posterior à data de assinatura.');
  if (d.valorMensal < 0) throw new ErroValidacao('O valor mensal não pode ser negativo.');
  return {
    dataAssinatura: assinatura,
    dataVencimento: vencimento,
    clausulas: d.clausulas,
    valorMensal: Math.round(d.valorMensal * 100) / 100,
    renovacaoAutomatica: d.renovacaoAutomatica ?? false
  };
}

// Acrescenta "contratoVigente" (equivalente ao Contrato.estaVigente() da AV1).
function comVigencia<T extends { contrato: { dataVencimento: Date } | null }>(org: T) {
  return { ...org, contratoVigente: org.contrato ? org.contrato.dataVencimento.getTime() >= Date.now() : false };
}

export class OrganizacaoServico {
  constructor(
    private readonly repo = new OrganizacaoRepositorio(),
    private readonly lotes = new LoteRepositorio(),
    private readonly equipamentos = new EquipamentoRepositorio(),
    private readonly validadorCnpj = new ValidadorCNPJ()
  ) {}

  async listar(filtro: { ativo?: boolean; busca?: string; pagina?: number; limite?: number }) {
    const pag = lerPaginacao(filtro);
    const [itens, total] = await this.repo.listar({ ativo: filtro.ativo, busca: filtro.busca }, pag);
    return { itens: itens.map(comVigencia), total, pagina: pag.pagina, limite: pag.limite };
  }

  async buscar(id: string) {
    const org = await this.repo.buscarPorId(id);
    if (!org) throw new NaoEncontrado('Organização');
    return comVigencia(org);
  }

  async criar(d: DadosOrganizacao, usuario: string) {
    if (!this.validadorCnpj.validar(d.cnpj)) throw new ErroValidacao(this.validadorCnpj.obterMensagemErro());
    const cnpj = somenteDigitos(d.cnpj);
    if (await this.repo.buscarPorCnpj(cnpj)) throw new Conflito('CNPJ já cadastrado.');

    const contrato = d.contrato ? montarContrato(d.contrato) : undefined;

    // Transação: organização + contrato + journal são gravados juntos, ou nada é gravado.
    const criada = await prisma.$transaction(async (tx) => {
      const org = await this.repo.criar(
        {
          razaoSocial: d.razaoSocial.trim(),
          cnpj,
          inscricaoEstadual: d.inscricaoEstadual ?? '',
          enderecoCompleto: d.enderecoCompleto ?? '',
          telefone: d.telefone ?? '',
          email: d.email ?? '',
          contrato: contrato ? { create: contrato } : undefined
        },
        tx
      );
      await registrarJournal(tx, { operacao: 'CRIAR', entidade: 'Organizacao', entidadeId: org.id, dadosDepois: org, usuario });
      return org;
    });
    return comVigencia(criada);
  }

  async atualizar(id: string, d: DadosAtualizacao, usuario: string) {
    const { versao, ...campos } = d;
    if (Object.keys(campos).length === 0) throw new ErroValidacao('Informe ao menos um campo para atualizar.');

    const nova = await prisma.$transaction(async (tx) => {
      const antes = await this.repo.buscarPorId(id, tx);
      if (!antes) throw new NaoEncontrado('Organização');

      const dados = { ...campos, ...(campos.razaoSocial ? { razaoSocial: campos.razaoSocial.trim() } : {}) };
      exigirAtualizacao(await this.repo.atualizarComVersao(id, versao, dados, tx), true, 'Organização');

      const depois = (await this.repo.buscarPorId(id, tx))!;
      await registrarJournal(tx, { operacao: 'ATUALIZAR', entidade: 'Organizacao', entidadeId: id, dadosAntes: antes, dadosDepois: depois, usuario });
      return depois;
    });
    return comVigencia(nova);
  }

  async alterarAtivo(id: string, ativo: boolean, versao: number, usuario: string) {
    const nova = await prisma.$transaction(async (tx) => {
      const antes = await this.repo.buscarPorId(id, tx);
      if (!antes) throw new NaoEncontrado('Organização');

      exigirAtualizacao(await this.repo.atualizarComVersao(id, versao, { ativo }, tx), true, 'Organização');

      // Soft delete em cadeia: inativar a organização inativa todos os lotes dela (e, com eles, os equipamentos).
      // Não há restrição por contrato nem por lotes em aberto. Reativar a organização NÃO reativa os lotes:
      // cada lote é reativado individualmente (PATCH /lotes/:id/ativo).
      const lotesInativados = !ativo ? await this.lotes.inativarDaOrganizacao(id, tx) : 0;

      const depois = (await this.repo.buscarPorId(id, tx))!;
      await registrarJournal(tx, {
        operacao: 'ATUALIZAR',
        entidade: 'Organizacao',
        entidadeId: id,
        dadosAntes: { ativo: antes.ativo },
        dadosDepois: { ativo, lotesInativados },
        usuario
      });
      return depois;
    });
    return comVigencia(nova);
  }

  // Cria o contrato (se a organização ainda não tem) ou substitui o existente (exige a versão atual).
  async definirContrato(organizacaoId: string, d: DadosContrato, versaoContrato: number | undefined, usuario: string) {
    const dados = montarContrato(d);

    await prisma.$transaction(async (tx) => {
      const org = await this.repo.buscarPorId(organizacaoId, tx);
      if (!org) throw new NaoEncontrado('Organização');

      if (!org.contrato) {
        const novo = await this.repo.criarContrato({ organizacaoId, ...dados }, tx);
        await registrarJournal(tx, { operacao: 'CRIAR', entidade: 'Contrato', entidadeId: novo.id, dadosDepois: novo, usuario });
        return;
      }
      if (versaoContrato === undefined) {
        throw new ErroValidacao('A organização já possui contrato. Informe a "versao" atual do contrato para substituí-lo.');
      }
      exigirAtualizacao(await this.repo.atualizarContratoComVersao(org.contrato.id, versaoContrato, dados, tx), true, 'Contrato');
      const depois = await this.repo.buscarContratoPorId(org.contrato.id, tx);
      await registrarJournal(tx, {
        operacao: 'ATUALIZAR',
        entidade: 'Contrato',
        entidadeId: org.contrato.id,
        dadosAntes: org.contrato,
        dadosDepois: depois,
        usuario
      });
    });
    return this.buscar(organizacaoId);
  }

  // Equivalente ao Contrato.renovar(novoVencimento) da AV1.
  async renovarContrato(organizacaoId: string, novoVencimento: string, versao: number, usuario: string) {
    const novaData = lerData(novoVencimento, 'novoVencimento');

    await prisma.$transaction(async (tx) => {
      const org = await this.repo.buscarPorId(organizacaoId, tx);
      if (!org) throw new NaoEncontrado('Organização');
      if (!org.contrato) throw new RegraNegocio('A organização não possui contrato para renovar.');
      if (novaData <= org.contrato.dataVencimento) {
        throw new RegraNegocio('O novo vencimento deve ser posterior ao vencimento atual do contrato.');
      }
      exigirAtualizacao(await this.repo.atualizarContratoComVersao(org.contrato.id, versao, { dataVencimento: novaData }, tx), true, 'Contrato');
      await registrarJournal(tx, {
        operacao: 'ATUALIZAR',
        entidade: 'Contrato',
        entidadeId: org.contrato.id,
        dadosAntes: { dataVencimento: org.contrato.dataVencimento },
        dadosDepois: { dataVencimento: novaData },
        usuario
      });
    });
    return this.buscar(organizacaoId);
  }

  // Remove o contrato da organização (contrato só tem exclusão definitiva). Sem contrato ativo, a organização
  // continua existindo, mas não recebe novos lotes.
  async removerContrato(organizacaoId: string, versao: number, usuario: string) {
    await prisma.$transaction(async (tx) => {
      const org = await this.repo.buscarPorId(organizacaoId, tx);
      if (!org) throw new NaoEncontrado('Organização');
      if (!org.contrato) throw new RegraNegocio('A organização não possui contrato.');
      exigirAtualizacao(await this.repo.excluirContratoComVersao(org.contrato.id, versao, tx), true, 'Contrato');
      await registrarJournal(tx, { operacao: 'EXCLUIR', entidade: 'Contrato', entidadeId: org.contrato.id, dadosAntes: org.contrato, usuario });
    });
    return this.buscar(organizacaoId);
  }

  // Exclusão definitiva (hard delete) em cadeia, numa única transação: movimentações -> equipamentos -> lotes ->
  // contrato -> organização. Se qualquer passo falhar, nada é removido. Tudo fica registrado no journal.
  async excluir(id: string, versao: number, usuario: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const org = await this.repo.buscarPorId(id, tx);
      if (!org) throw new NaoEncontrado('Organização');

      const lotes = await this.lotes.listarDaOrganizacao(id, tx);
      await this.equipamentos.excluirDaOrganizacao(id, tx);
      await this.lotes.excluirDaOrganizacao(id, tx);

      const { contrato, ...dadosOrg } = org;
      if (contrato) {
        exigirAtualizacao(await this.repo.excluirContratoComVersao(contrato.id, contrato.versao, tx), true, 'Contrato');
      }
      exigirAtualizacao(await this.repo.excluirComVersao(id, versao, tx), true, 'Organização');

      for (const l of lotes) {
        const { equipamentos, ...dadosLote } = l;
        for (const e of equipamentos) {
          await registrarJournal(tx, { operacao: 'EXCLUIR', entidade: 'Equipamento', entidadeId: e.id, dadosAntes: e, usuario });
        }
        await registrarJournal(tx, {
          operacao: 'EXCLUIR',
          entidade: 'Lote',
          entidadeId: l.id,
          dadosAntes: { ...dadosLote, equipamentosRemovidos: equipamentos.map((e) => e.codigoBarrasInterno) },
          usuario
        });
      }
      if (contrato) {
        await registrarJournal(tx, { operacao: 'EXCLUIR', entidade: 'Contrato', entidadeId: contrato.id, dadosAntes: contrato, usuario });
      }
      await registrarJournal(tx, {
        operacao: 'EXCLUIR',
        entidade: 'Organizacao',
        entidadeId: id,
        dadosAntes: { ...dadosOrg, lotesRemovidos: lotes.length },
        usuario
      });
    });
  }
}

// escrito com carinho por Arthur.
