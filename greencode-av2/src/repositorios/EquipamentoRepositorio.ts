import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type Cliente = Prisma.TransactionClient;

export class EquipamentoRepositorio {
  buscarPorId(id: string, tx: Cliente = prisma) {
    return tx.equipamento.findUnique({
      where: { id },
      include: { lote: { select: { id: true, statusProcessamento: true, ativo: true, organizacaoId: true, notaFiscal: true } } }
    });
  }

  listar(f: {
    status?: Prisma.EquipamentoWhereInput['statusRastreamento'];
    tipo?: Prisma.EquipamentoWhereInput['tipo'];
    loteId?: string;
  }) {
    const where: Prisma.EquipamentoWhereInput = {};
    if (f.status) where.statusRastreamento = f.status;
    if (f.tipo) where.tipo = f.tipo;
    if (f.loteId) where.loteId = f.loteId;
    return prisma.equipamento.findMany({ where, orderBy: [{ loteId: 'asc' }, { posicaoNoLote: 'asc' }], take: 500 });
  }

  async ultimaPosicao(loteId: string, tx: Cliente = prisma): Promise<number> {
    const r = await tx.equipamento.aggregate({ where: { loteId }, _max: { posicaoNoLote: true } });
    return r._max.posicaoNoLote ?? 0;
  }

  criar(data: Prisma.EquipamentoUncheckedCreateInput, tx: Cliente = prisma) {
    return tx.equipamento.create({ data });
  }

  async atualizarComVersao(id: string, versao: number, data: Prisma.EquipamentoUpdateManyMutationInput, tx: Cliente = prisma) {
    const r = await tx.equipamento.updateMany({ where: { id, versao }, data: { ...data, versao: { increment: 1 } } });
    return r.count;
  }

  listarPorLoteEStatus(loteId: string, status: Prisma.EquipamentoWhereInput['statusRastreamento'], tx: Cliente = prisma) {
    return tx.equipamento.findMany({ where: { loteId, statusRastreamento: status } });
  }

  async mudarStatusEmMassa(ids: string[], novo: NonNullable<Prisma.EquipamentoUpdateManyMutationInput['statusRastreamento']>, tx: Cliente = prisma) {
    const r = await tx.equipamento.updateMany({
      where: { id: { in: ids } },
      data: { statusRastreamento: novo, versao: { increment: 1 } }
    });
    return r.count;
  }

  equipamentosNaoBaixados(loteId: string, tx: Cliente = prisma) {
    return tx.equipamento.count({ where: { loteId, statusRastreamento: { not: 'BAIXA_DEFINITIVA' } } });
  }

  contarMovimentacoes(equipamentoId: string, tx: Cliente = prisma) {
    return tx.movimentacao.count({ where: { equipamentoId } });
  }

  // Exclui o equipamento e o histórico dele (somente com a versão informada). Retorna as linhas removidas.
  async excluirComVersao(id: string, versao: number, tx: Cliente = prisma) {
    await tx.movimentacao.deleteMany({ where: { equipamentoId: id } });
    const r = await tx.equipamento.deleteMany({ where: { id, versao } });
    return r.count;
  }

  // Exclui todos os equipamentos de um lote (e as movimentações deles). Usado ao excluir o lote.
  async excluirDoLote(loteId: string, tx: Cliente = prisma) {
    await tx.movimentacao.deleteMany({ where: { equipamento: { loteId } } });
    const r = await tx.equipamento.deleteMany({ where: { loteId } });
    return r.count;
  }

  // Exclui todos os equipamentos (e movimentações) de todos os lotes de uma organização. Usado na exclusão em cadeia.
  async excluirDaOrganizacao(organizacaoId: string, tx: Cliente = prisma) {
    await tx.movimentacao.deleteMany({ where: { equipamento: { lote: { organizacaoId } } } });
    const r = await tx.equipamento.deleteMany({ where: { lote: { organizacaoId } } });
    return r.count;
  }

  criarMovimentacao(data: Prisma.MovimentacaoUncheckedCreateInput, tx: Cliente = prisma) {
    return tx.movimentacao.create({ data });
  }

  criarMovimentacoes(data: Prisma.MovimentacaoUncheckedCreateInput[], tx: Cliente = prisma) {
    return tx.movimentacao.createMany({ data });
  }

  listarMovimentacoes(equipamentoId: string) {
    return prisma.movimentacao.findMany({ where: { equipamentoId }, orderBy: { dataHora: 'asc' } });
  }

  ultimaMovimentacao(equipamentoId: string, tx: Cliente = prisma) {
    return tx.movimentacao.findFirst({ where: { equipamentoId }, orderBy: { dataHora: 'desc' } });
  }
}

// Alves aprova este código.
