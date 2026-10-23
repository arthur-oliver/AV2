import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { Paginacao } from '../utils/paginacao';

type Cliente = Prisma.TransactionClient;

const orgResumo = { select: { id: true, razaoSocial: true } } as const;

export class LoteRepositorio {
  buscarPorId(id: string, tx: Cliente = prisma) {
    return tx.lote.findUnique({
      where: { id },
      include: { equipamentos: { orderBy: { posicaoNoLote: 'asc' } }, organizacao: orgResumo }
    });
  }

  listar(f: { organizacaoId?: string; status?: Prisma.LoteWhereInput['statusProcessamento']; ativo?: boolean; inicio?: Date; fim?: Date }, pag: Paginacao) {
    const where: Prisma.LoteWhereInput = {};
    if (f.organizacaoId) where.organizacaoId = f.organizacaoId;
    if (f.status) where.statusProcessamento = f.status;
    if (f.ativo !== undefined) where.ativo = f.ativo;
    if (f.inicio || f.fim) where.dataEntrada = { ...(f.inicio && { gte: f.inicio }), ...(f.fim && { lte: f.fim }) };
    return prisma.$transaction([
      prisma.lote.findMany({
        where,
        include: { _count: { select: { equipamentos: true } }, organizacao: orgResumo },
        orderBy: { dataEntrada: 'desc' },
        skip: pag.skip,
        take: pag.take
      }),
      prisma.lote.count({ where })
    ]);
  }

  criar(data: Prisma.LoteUncheckedCreateInput, tx: Cliente = prisma) {
    return tx.lote.create({ data });
  }

  // Retorna linhas afetadas (0 = versão desatualizada ou lote inexistente).
  async atualizarComVersao(id: string, versao: number, data: Prisma.LoteUpdateManyMutationInput, tx: Cliente = prisma) {
    const r = await tx.lote.updateMany({ where: { id, versao }, data: { ...data, versao: { increment: 1 } } });
    return r.count;
  }

  // Grava o status derivado dos equipamentos (e incrementa a versão).
  async definirStatus(id: string, status: Prisma.LoteUpdateManyMutationInput['statusProcessamento'], tx: Cliente = prisma) {
    await tx.lote.update({ where: { id }, data: { statusProcessamento: status, versao: { increment: 1 } } });
  }

  // Incrementa a versão do lote (serializa operações simultâneas sobre o mesmo lote).
  async incrementarVersao(id: string, tx: Cliente = prisma) {
    await tx.lote.update({ where: { id }, data: { versao: { increment: 1 } } });
  }

  // Exclui o lote somente se a versão for a informada. Retorna as linhas removidas (0 = versão desatualizada).
  async excluirComVersao(id: string, versao: number, tx: Cliente = prisma) {
    const r = await tx.lote.deleteMany({ where: { id, versao } });
    return r.count;
  }

  // --- Operações em cadeia (a partir da organização) ---

  // Lotes da organização com seus equipamentos (usado para registrar no journal o que será removido).
  listarDaOrganizacao(organizacaoId: string, tx: Cliente = prisma) {
    return tx.lote.findMany({ where: { organizacaoId }, include: { equipamentos: true } });
  }

  // Soft delete em cadeia: inativa todos os lotes ainda ativos da organização. Retorna quantos foram inativados.
  async inativarDaOrganizacao(organizacaoId: string, tx: Cliente = prisma) {
    const r = await tx.lote.updateMany({
      where: { organizacaoId, ativo: true },
      data: { ativo: false, versao: { increment: 1 } }
    });
    return r.count;
  }

  async excluirDaOrganizacao(organizacaoId: string, tx: Cliente = prisma) {
    const r = await tx.lote.deleteMany({ where: { organizacaoId } });
    return r.count;
  }
}

// Arthur Oliver Rossi Alves, autor do Greencode.
