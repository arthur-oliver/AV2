import { prisma } from '../lib/prisma';
import { EquipamentoRepositorio } from '../repositorios/EquipamentoRepositorio';
import { LoteRepositorio } from '../repositorios/LoteRepositorio';
import { ErroValidacao, NaoEncontrado, RegraNegocio } from '../erros/AppError';
import { registrarJournal } from '../utils/auditoria';
import { exigirAtualizacao } from '../utils/versao';
import { validarMudancaEstadoFisico } from '../regras/estadoFisico';
import { statusLoteDerivado } from '../regras/statusLote';
import { lerPaginacao } from '../utils/paginacao';
import type { Prisma } from '@prisma/client';
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

// Equipamento de lote inativado (soft delete em cadeia) fica só para consulta.
function exigirLoteAtivo(e: { lote: { ativo: boolean } }): void {
  if (!e.lote.ativo) throw new RegraNegocio('O lote deste equipamento está inativo. Reative o lote para alterar o equipamento.');
}

export class EquipamentoServico {
  constructor(
    private readonly repo = new EquipamentoRepositorio(),
    private readonly lotes = new LoteRepositorio()
  ) {}

  async listar(f: { status?: StatusRastreamento; tipo?: TipoEquipamento; loteId?: string; pagina?: number; limite?: number }) {
    const pag = lerPaginacao(f);
    const [itens, total] = await this.repo.listar({ status: f.status, tipo: f.tipo, loteId: f.loteId }, pag);
    return { itens, total, pagina: pag.pagina, limite: pag.limite };
  }

  // O status do lote é derivado dos equipamentos: só muda quando TODOS têm o mesmo status (ver regras/statusLote.ts).
  private async sincronizarStatusDoLote(tx: Prisma.TransactionClient, loteId: string, statusAtual: string, usuario: string) {
    const novo = statusLoteDerivado(await this.repo.statusDoLote(loteId, tx));
    if (!novo || novo === statusAtual) return;
    await this.lotes.definirStatus(loteId, novo, tx);
    await registrarJournal(tx, {
      operacao: 'STATUS',
      entidade: 'Lote',
      entidadeId: loteId,
      dadosAntes: { statusProcessamento: statusAtual },
      dadosDepois: { statusProcessamento: novo, origem: 'derivado dos equipamentos' },
      usuario
    });
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
      exigirLoteAtivo(e);

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
      await this.sincronizarStatusDoLote(tx, e.loteId, e.lote.statusProcessamento, usuario);
    });
    return this.buscar(id);
  }

  async alterarEstadoFisico(id: string, novo: EstadoFisico, justificativa: string | undefined, versao: number, usuario: string) {
    await prisma.$transaction(async (tx) => {
      const e = await this.repo.buscarPorId(id, tx);
      if (!e) throw new NaoEncontrado('Equipamento');
      exigirLoteAtivo(e);
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
      exigirLoteAtivo(e);
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
      exigirLoteAtivo(e);
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

  // Exclusão definitiva do equipamento (e das movimentações dele), em qualquer fase. Equipamento não tem soft delete.
  async excluir(id: string, versao: number, usuario: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const e = await this.repo.buscarPorId(id, tx);
      if (!e) throw new NaoEncontrado('Equipamento');
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
      await this.sincronizarStatusDoLote(tx, e.loteId, e.lote.statusProcessamento, usuario);
    });
  }
}

// Alves aprova este código.
