import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { LoteRepositorio } from '../repositorios/LoteRepositorio';
import { EquipamentoRepositorio } from '../repositorios/EquipamentoRepositorio';
import { OrganizacaoRepositorio } from '../repositorios/OrganizacaoRepositorio';
import { ValidadorDataEntrada } from '../validadores/ValidadorDataEntrada';
import { ErroValidacao, NaoEncontrado, RegraNegocio } from '../erros/AppError';
import { registrarJournal } from '../utils/auditoria';
import { exigirAtualizacao } from '../utils/versao';
import { gerarCodigoBarras } from '../utils/codigoBarras';
import { intervalo, lerData } from '../utils/datas';
import { EstadoFisico, StatusLote, StatusRastreamento } from '../dominio/enums';
import type { EstadoFisico as TEstado, StatusLote as TStatusLote, TipoEquipamento } from '../dominio/enums';

export interface NovoEquipamento {
  codigoBarrasInterno?: string;
  tipo: TipoEquipamento;
  marca?: string;
  modelo?: string;
  anoFabricacao: number;
  estadoFisico?: TEstado;
  pesoQuilogramas: number;
}

export interface DadosLote {
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  dataEntrada?: string;
  observacoes?: string;
  equipamentos?: NovoEquipamento[];
}

export interface DadosEdicaoLote {
  notaFiscal?: string;
  transportadora?: string;
  observacoes?: string;
  dataEntrada?: string;
}

// Ordem permitida depois da triagem: TRIAGEM_CONCLUIDA -> ENCAMINHADO -> FINALIZADO
const PROXIMO_STATUS: Record<string, TStatusLote | undefined> = {
  [StatusLote.TRIAGEM_CONCLUIDA]: StatusLote.ENCAMINHADO,
  [StatusLote.ENCAMINHADO]: StatusLote.FINALIZADO
};

function validarItens(itens: NovoEquipamento[]): void {
  const anoMax = new Date().getFullYear() + 1;
  for (const e of itens) {
    if (e.anoFabricacao > anoMax) throw new ErroValidacao(`Ano de fabricação inválido: ${e.anoFabricacao}.`);
  }
}

// Equivalente a Lote.calcularPesoTotal() e gerarRelatorioTriagem() da AV1.
function resumo(l: { id: string; statusProcessamento: string; equipamentos: { pesoQuilogramas: unknown }[] }) {
  const peso = l.equipamentos.reduce((s, e) => s + Number(e.pesoQuilogramas), 0);
  const pesoTotalKg = Math.round(peso * 1000) / 1000;
  return {
    quantidade: l.equipamentos.length,
    pesoTotalKg,
    relatorioTriagem: `Lote ${l.id}: ${l.equipamentos.length} equipamento(s), ${pesoTotalKg.toFixed(2)} kg, status ${l.statusProcessamento}.`
  };
}

export class LoteServico {
  constructor(
    private readonly lotes = new LoteRepositorio(),
    private readonly equipamentos = new EquipamentoRepositorio(),
    private readonly organizacoes = new OrganizacaoRepositorio(),
    private readonly validadorData = new ValidadorDataEntrada()
  ) {}

  async listar(f: { organizacaoId?: string; status?: TStatusLote; inicio?: string; fim?: string }) {
    const per = f.inicio || f.fim ? intervalo(f.inicio, f.fim) : undefined;
    return this.lotes.listar({ organizacaoId: f.organizacaoId, status: f.status, inicio: per?.inicio, fim: per?.fim });
  }

  async buscar(id: string) {
    const l = await this.lotes.buscarPorId(id);
    if (!l) throw new NaoEncontrado('Lote');
    return { ...l, resumo: resumo(l) };
  }

  // Cria o lote (e, opcionalmente, seus equipamentos) numa ÚNICA transação:
  // ou tudo é gravado, ou nada é.
  async criar(d: DadosLote, usuario: string) {
    const data = d.dataEntrada ? lerData(d.dataEntrada, 'dataEntrada') : new Date();
    if (!this.validadorData.validar(data)) throw new ErroValidacao(this.validadorData.obterMensagemErro());

    const org = await this.organizacoes.buscarPorId(d.organizacaoId);
    if (!org) throw new NaoEncontrado('Organização');
    if (!org.ativo) throw new RegraNegocio('A organização está inativa e não pode receber novos lotes.');
    validarItens(d.equipamentos ?? []);

    const id = await prisma.$transaction(async (tx) => {
      const lote = await this.lotes.criar(
        {
          organizacaoId: d.organizacaoId,
          dataEntrada: data,
          notaFiscal: d.notaFiscal.trim(),
          transportadora: d.transportadora.trim(),
          observacoes: d.observacoes ?? ''
        },
        tx
      );
      const criados = await this.criarEquipamentos(tx, lote.id, 0, d.equipamentos ?? [], usuario);
      await registrarJournal(tx, {
        operacao: 'CRIAR',
        entidade: 'Lote',
        entidadeId: lote.id,
        dadosDepois: { ...lote, equipamentos: criados },
        usuario
      });
      return lote.id;
    });
    return this.buscar(id);
  }

  async adicionarEquipamentos(loteId: string, versao: number, itens: NovoEquipamento[], usuario: string) {
    validarItens(itens);
    await prisma.$transaction(async (tx) => {
      const lote = await this.lotes.buscarPorId(loteId, tx);
      if (!lote) throw new NaoEncontrado('Lote');
      if (lote.statusProcessamento !== StatusLote.RECEBIDO) {
        throw new RegraNegocio('Só é possível adicionar equipamentos a lotes com status RECEBIDO (antes da triagem).');
      }
      // Incrementar a versão do lote serializa duas inclusões simultâneas: a segunda recebe 409.
      exigirAtualizacao(await this.lotes.atualizarComVersao(loteId, versao, {}, tx), true, 'Lote');
      const ultima = await this.equipamentos.ultimaPosicao(loteId, tx);
      const criados = await this.criarEquipamentos(tx, loteId, ultima, itens, usuario);
      await registrarJournal(tx, {
        operacao: 'ATUALIZAR',
        entidade: 'Lote',
        entidadeId: loteId,
        dadosDepois: { equipamentosAdicionados: criados.map((e) => e.codigoBarrasInterno) },
        usuario
      });
    });
    return this.buscar(loteId);
  }

  // Equivalente ao processarTriagem() da AV1: RECEBIDO -> TRIAGEM_CONCLUIDA e todos os
  // equipamentos AGUARDANDO_TRIAGEM passam a EM_TRIAGEM, com movimentação registrada.
  async processarTriagem(loteId: string, versao: number, usuario: string) {
    await prisma.$transaction(async (tx) => {
      const lote = await this.lotes.buscarPorId(loteId, tx);
      if (!lote) throw new NaoEncontrado('Lote');
      if (lote.statusProcessamento !== StatusLote.RECEBIDO) {
        throw new RegraNegocio(`A triagem só pode ser processada em lotes RECEBIDO (status atual: ${lote.statusProcessamento}).`);
      }
      if (lote.equipamentos.length === 0) throw new RegraNegocio('O lote não possui equipamentos para triagem.');

      exigirAtualizacao(
        await this.lotes.atualizarComVersao(loteId, versao, { statusProcessamento: StatusLote.TRIAGEM_CONCLUIDA }, tx),
        true,
        'Lote'
      );

      const pendentes = await this.equipamentos.listarPorLoteEStatus(loteId, StatusRastreamento.AGUARDANDO_TRIAGEM, tx);
      await this.equipamentos.mudarStatusEmMassa(pendentes.map((e) => e.id), StatusRastreamento.EM_TRIAGEM, tx);
      await this.equipamentos.criarMovimentacoes(
        pendentes.map((e) => ({
          equipamentoId: e.id,
          origem: StatusRastreamento.AGUARDANDO_TRIAGEM,
          destino: StatusRastreamento.EM_TRIAGEM,
          responsavel: usuario,
          observacao: 'Triagem do lote processada.'
        })),
        tx
      );
      await registrarJournal(tx, {
        operacao: 'STATUS',
        entidade: 'Lote',
        entidadeId: loteId,
        dadosAntes: { statusProcessamento: lote.statusProcessamento },
        dadosDepois: { statusProcessamento: StatusLote.TRIAGEM_CONCLUIDA, equipamentosEmTriagem: pendentes.length },
        usuario
      });
    });
    return this.buscar(loteId);
  }

  async avancarStatus(loteId: string, novo: TStatusLote, versao: number, usuario: string) {
    await prisma.$transaction(async (tx) => {
      const lote = await this.lotes.buscarPorId(loteId, tx);
      if (!lote) throw new NaoEncontrado('Lote');

      if (PROXIMO_STATUS[lote.statusProcessamento] !== novo) {
        throw new RegraNegocio(`Transição inválida: ${lote.statusProcessamento} -> ${novo}.`);
      }
      if (novo === StatusLote.FINALIZADO && (await this.equipamentos.equipamentosNaoBaixados(loteId, tx)) > 0) {
        throw new RegraNegocio('Para finalizar o lote, todos os equipamentos devem estar em BAIXA_DEFINITIVA.');
      }
      exigirAtualizacao(await this.lotes.atualizarComVersao(loteId, versao, { statusProcessamento: novo }, tx), true, 'Lote');
      await registrarJournal(tx, {
        operacao: 'STATUS',
        entidade: 'Lote',
        entidadeId: loteId,
        dadosAntes: { statusProcessamento: lote.statusProcessamento },
        dadosDepois: { statusProcessamento: novo },
        usuario
      });
    });
    return this.buscar(loteId);
  }

  // Corrige os dados do lote (nota fiscal, transportadora, observações). A data de entrada só pode ser
  // corrigida antes da triagem e continua obedecendo à regra dos 90 dias. Lote finalizado não muda mais.
  async atualizar(loteId: string, d: DadosEdicaoLote, versao: number, usuario: string) {
    const { dataEntrada, ...textos } = d;
    const campos: Prisma.LoteUpdateManyMutationInput = {};
    if (textos.notaFiscal !== undefined) campos.notaFiscal = textos.notaFiscal.trim();
    if (textos.transportadora !== undefined) campos.transportadora = textos.transportadora.trim();
    if (textos.observacoes !== undefined) campos.observacoes = textos.observacoes;
    if (dataEntrada !== undefined) {
      const data = lerData(dataEntrada, 'dataEntrada');
      if (!this.validadorData.validar(data)) throw new ErroValidacao(this.validadorData.obterMensagemErro());
      campos.dataEntrada = data;
    }
    if (Object.keys(campos).length === 0) throw new ErroValidacao('Informe ao menos um campo para atualizar.');

    await prisma.$transaction(async (tx) => {
      const lote = await this.lotes.buscarPorId(loteId, tx);
      if (!lote) throw new NaoEncontrado('Lote');
      if (lote.statusProcessamento === StatusLote.FINALIZADO) {
        throw new RegraNegocio('Lote finalizado não pode ser alterado.');
      }
      if (campos.dataEntrada !== undefined && lote.statusProcessamento !== StatusLote.RECEBIDO) {
        throw new RegraNegocio('A data de entrada só pode ser corrigida antes da triagem (lote RECEBIDO).');
      }
      exigirAtualizacao(await this.lotes.atualizarComVersao(loteId, versao, campos, tx), true, 'Lote');

      const antes: Record<string, unknown> = {};
      for (const k of Object.keys(campos)) antes[k] = (lote as Record<string, unknown>)[k];
      await registrarJournal(tx, { operacao: 'ATUALIZAR', entidade: 'Lote', entidadeId: loteId, dadosAntes: antes, dadosDepois: campos, usuario });
    });
    return this.buscar(loteId);
  }

  // Exclui um lote registrado por engano (junto com seus equipamentos e movimentações). Só antes da triagem.
  // Cada item removido fica registrado no journal, então a exclusão continua auditável.
  async excluir(loteId: string, versao: number, usuario: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const lote = await this.lotes.buscarPorId(loteId, tx);
      if (!lote) throw new NaoEncontrado('Lote');
      if (lote.statusProcessamento !== StatusLote.RECEBIDO) {
        throw new RegraNegocio(
          `Só é possível excluir lotes com status RECEBIDO (antes da triagem). Status atual: ${lote.statusProcessamento}.`
        );
      }
      if (lote.equipamentos.some((e) => e.statusRastreamento !== StatusRastreamento.AGUARDANDO_TRIAGEM)) {
        throw new RegraNegocio('O lote possui equipamentos já movimentados e não pode ser excluído.');
      }

      await this.equipamentos.excluirDoLote(loteId, tx);
      exigirAtualizacao(await this.lotes.excluirComVersao(loteId, versao, tx), true, 'Lote');

      const { equipamentos, organizacao: _org, ...dadosLote } = lote;
      for (const e of equipamentos) {
        await registrarJournal(tx, { operacao: 'EXCLUIR', entidade: 'Equipamento', entidadeId: e.id, dadosAntes: e, usuario });
      }
      await registrarJournal(tx, {
        operacao: 'EXCLUIR',
        entidade: 'Lote',
        entidadeId: loteId,
        dadosAntes: { ...dadosLote, equipamentosRemovidos: equipamentos.map((e) => e.codigoBarrasInterno) },
        usuario
      });
    });
  }

  // Cria equipamentos em sequência (posição 1, 2, 3...) já com a movimentação de recebimento.
  private async criarEquipamentos(tx: Prisma.TransactionClient, loteId: string, ultimaPosicao: number, itens: NovoEquipamento[], usuario: string) {
    const criados = [];
    let pos = ultimaPosicao;
    for (const e of itens) {
      pos += 1;
      const eq = await this.equipamentos.criar(
        {
          loteId,
          posicaoNoLote: pos,
          codigoBarrasInterno: e.codigoBarrasInterno?.trim() || gerarCodigoBarras(e.tipo),
          tipo: e.tipo,
          marca: e.marca ?? '',
          modelo: e.modelo ?? '',
          anoFabricacao: e.anoFabricacao,
          estadoFisico: e.estadoFisico ?? EstadoFisico.USADO_LEVE,
          pesoQuilogramas: e.pesoQuilogramas,
          statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM
        },
        tx
      );
      await this.equipamentos.criarMovimentacao(
        {
          equipamentoId: eq.id,
          origem: 'CLIENTE',
          destino: StatusRastreamento.AGUARDANDO_TRIAGEM,
          responsavel: usuario,
          observacao: 'Recebimento do lote.'
        },
        tx
      );
      await registrarJournal(tx, { operacao: 'CRIAR', entidade: 'Equipamento', entidadeId: eq.id, dadosDepois: eq, usuario });
      criados.push(eq);
    }
    return criados;
  }
}

// Arthur Oliver Rossi Alves, autor do Greencode.
