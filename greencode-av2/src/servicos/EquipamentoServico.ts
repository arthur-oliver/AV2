import { prisma } from '../lib/prisma';
import { EquipamentoRepositorio } from '../repositorios/EquipamentoRepositorio';
import { LoteRepositorio } from '../repositorios/LoteRepositorio';
import { ErroValidacao, NaoEncontrado, RegraNegocio } from '../erros/AppError';
import { registrarJournal } from '../utils/auditoria';
import { exigirAtualizacao } from '../utils/versao';
import { validarMudancaEstadoFisico } from '../regras/estadoFisico';
import { transicoesPermitidas, validarTransicaoRastreamento } from '../regras/rastreamento';
import { StatusLote, StatusRastreamento as Status } from '../dominio/enums';
import type { EstadoFisico, StatusRastreamento, TipoEquipamento } from '../dominio/enums';

// Dados cadastrais que podem ser corrigidos. O código de barras e o estado físico/status têm rotas próprias
// (o código identifica o equipamento no rastreamento e nunca muda).
export interface DadosEdicaoEquipamento {
  tipo?: TipoEquipamento;
  marca?: string;
  modelo?: string;
  anoFabricacao?: number;
  pesoQuilogramas?: number;
}

export class EquipamentoServico {
  constructor(
    private readonly repo = new EquipamentoRepositorio(),
    private readonly lotes = new LoteRepositorio()
  ) {}

  listar(f: { status?: StatusRastreamento; tipo?: TipoEquipamento; loteId?: string }) {
    return this.repo.listar(f);
  }

  async buscar(id: string) {
    const e = await this.repo.buscarPorId(id);
    if (!e) throw new NaoEncontrado('Equipamento');
    return { ...e, proximosStatusPermitidos: transicoesPermitidas(e.statusRastreamento) };
  }

  // Equivalente ao rastrearEquipamento() / HistoricoCompleto da AV1.
  async rastrear(id: string) {
    const e = await this.repo.buscarPorId(id);
    if (!e) throw new NaoEncontrado('Equipamento');
    return { equipamento: e, movimentacoes: await this.repo.listarMovimentacoes(id) };
  }

  // Muda o status e registra a movimentação NA MESMA transação (atomicidade).
  async alterarStatus(id: string, novo: StatusRastreamento, justificativa: string, versao: number, usuario: string) {
    await prisma.$transaction(async (tx) => {
      const e = await this.repo.buscarPorId(id, tx);
      if (!e) throw new NaoEncontrado('Equipamento');

      validarTransicaoRastreamento(e.statusRastreamento, novo, e.lote.statusProcessamento, justificativa);

      exigirAtualizacao(await this.repo.atualizarComVersao(id, versao, { statusRastreamento: novo }, tx), true, 'Equipamento');
      await this.repo.criarMovimentacao(
        { equipamentoId: id, origem: e.statusRastreamento, destino: novo, responsavel: usuario, observacao: justificativa.trim() },
        tx
      );
      await registrarJournal(tx, {
        operacao: 'STATUS',
        entidade: 'Equipamento',
        entidadeId: id,
        dadosAntes: { statusRastreamento: e.statusRastreamento },
        dadosDepois: { statusRastreamento: novo, justificativa },
        usuario
      });
    });
    return this.buscar(id);
  }

  async alterarEstadoFisico(id: string, novo: EstadoFisico, justificativa: string | undefined, versao: number, usuario: string) {
    await prisma.$transaction(async (tx) => {
      const e = await this.repo.buscarPorId(id, tx);
      if (!e) throw new NaoEncontrado('Equipamento');
      if (e.estadoFisico === novo) throw new RegraNegocio('O equipamento já está neste estado físico.');

      validarMudancaEstadoFisico(e.estadoFisico, novo, justificativa);

      exigirAtualizacao(await this.repo.atualizarComVersao(id, versao, { estadoFisico: novo }, tx), true, 'Equipamento');
      await registrarJournal(tx, {
        operacao: 'ATUALIZAR',
        entidade: 'Equipamento',
        entidadeId: id,
        dadosAntes: { estadoFisico: e.estadoFisico },
        dadosDepois: { estadoFisico: novo, justificativa: justificativa ?? null },
        usuario
      });
    });
    return this.buscar(id);
  }

  // Movimentação física (ex.: "Galpão B", "Transportadora X") sem mudar o status. Só acrescenta histórico.
  async registrarMovimentacao(id: string, destino: string, observacao: string | undefined, usuario: string) {
    return prisma.$transaction(async (tx) => {
      const e = await this.repo.buscarPorId(id, tx);
      if (!e) throw new NaoEncontrado('Equipamento');
      const ultima = await this.repo.ultimaMovimentacao(id, tx);
      const mov = await this.repo.criarMovimentacao(
        {
          equipamentoId: id,
          origem: ultima?.destino ?? 'CLIENTE',
          destino: destino.trim(),
          responsavel: usuario,
          observacao: observacao?.trim() ?? ''
        },
        tx
      );
      await registrarJournal(tx, { operacao: 'CRIAR', entidade: 'Movimentacao', entidadeId: mov.id, dadosDepois: mov, usuario });
      return mov;
    });
  }

  // Corrige os dados cadastrais (marca, modelo, ano, peso, tipo). Vale enquanto o equipamento e o lote não estiverem encerrados.
  async atualizar(id: string, dados: DadosEdicaoEquipamento, versao: number, usuario: string) {
    const campos = Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined)) as DadosEdicaoEquipamento;
    if (Object.keys(campos).length === 0) throw new ErroValidacao('Informe ao menos um campo para atualizar.');
    if (campos.anoFabricacao !== undefined && campos.anoFabricacao > new Date().getFullYear() + 1) {
      throw new ErroValidacao(`Ano de fabricação inválido: ${campos.anoFabricacao}.`);
    }
    if (campos.marca !== undefined) campos.marca = campos.marca.trim();
    if (campos.modelo !== undefined) campos.modelo = campos.modelo.trim();

    await prisma.$transaction(async (tx) => {
      const e = await this.repo.buscarPorId(id, tx);
      if (!e) throw new NaoEncontrado('Equipamento');
      if (e.statusRastreamento === Status.BAIXA_DEFINITIVA || e.lote.statusProcessamento === StatusLote.FINALIZADO) {
        throw new RegraNegocio('Equipamento com baixa definitiva ou de lote finalizado não pode ser editado.');
      }
      exigirAtualizacao(await this.repo.atualizarComVersao(id, versao, campos, tx), true, 'Equipamento');

      const antes: Record<string, unknown> = {};
      for (const k of Object.keys(campos)) antes[k] = (e as Record<string, unknown>)[k];
      await registrarJournal(tx, { operacao: 'ATUALIZAR', entidade: 'Equipamento', entidadeId: id, dadosAntes: antes, dadosDepois: campos, usuario });
    });
    return this.buscar(id);
  }

  // Exclui um equipamento cadastrado por engano. Só é permitido antes da triagem (lote RECEBIDO e equipamento
  // AGUARDANDO_TRIAGEM): depois disso, ele já faz parte do histórico de rastreabilidade.
  async excluir(id: string, versao: number, usuario: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const e = await this.repo.buscarPorId(id, tx);
      if (!e) throw new NaoEncontrado('Equipamento');
      if (e.lote.statusProcessamento !== StatusLote.RECEBIDO || e.statusRastreamento !== Status.AGUARDANDO_TRIAGEM) {
        throw new RegraNegocio(
          'Só é possível excluir equipamentos antes da triagem (lote RECEBIDO e equipamento AGUARDANDO_TRIAGEM). Depois disso o equipamento faz parte do histórico.'
        );
      }
      const movimentacoes = await this.repo.contarMovimentacoes(id, tx);
      // Mexer na versão do lote impede que a exclusão corra junto com a triagem do mesmo lote.
      await this.lotes.incrementarVersao(e.loteId, tx);
      exigirAtualizacao(await this.repo.excluirComVersao(id, versao, tx), true, 'Equipamento');

      const { lote: _lote, ...dados } = e;
      await registrarJournal(tx, {
        operacao: 'EXCLUIR',
        entidade: 'Equipamento',
        entidadeId: id,
        dadosAntes: { ...dados, movimentacoesRemovidas: movimentacoes },
        usuario
      });
    });
  }
}

// Alves aprova este código.
