import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { Paginacao } from '../utils/paginacao';

type Cliente = Prisma.TransactionClient;

// Camada de repositório: só acesso a dados (Prisma). Nenhuma regra de negócio aqui.
export class OrganizacaoRepositorio {
  buscarPorId(id: string, tx: Cliente = prisma) {
    return tx.organizacao.findUnique({ where: { id }, include: { contrato: true } });
  }

  buscarPorCnpj(cnpj: string, tx: Cliente = prisma) {
    return tx.organizacao.findUnique({ where: { cnpj } });
  }

  listar(filtro: { ativo?: boolean; busca?: string }, pag: Paginacao) {
    const where: Prisma.OrganizacaoWhereInput = {};
    if (filtro.ativo !== undefined) where.ativo = filtro.ativo;
    if (filtro.busca) {
      where.OR = [{ razaoSocial: { contains: filtro.busca } }, { cnpj: { contains: filtro.busca.replace(/\D/g, '') || '#' } }];
    }
    return prisma.$transaction([
      prisma.organizacao.findMany({ where, include: { contrato: true }, orderBy: { razaoSocial: 'asc' }, skip: pag.skip, take: pag.take }),
      prisma.organizacao.count({ where })
    ]);
  }

  criar(data: Prisma.OrganizacaoCreateInput, tx: Cliente = prisma) {
    return tx.organizacao.create({ data, include: { contrato: true } });
  }

  // Retorna quantas linhas foram atualizadas (0 = versão desatualizada ou id inexistente).
  async atualizarComVersao(id: string, versao: number, data: Prisma.OrganizacaoUpdateManyMutationInput, tx: Cliente = prisma) {
    const r = await tx.organizacao.updateMany({ where: { id, versao }, data: { ...data, versao: { increment: 1 } } });
    return r.count;
  }

  criarContrato(data: Prisma.ContratoUncheckedCreateInput, tx: Cliente = prisma) {
    return tx.contrato.create({ data });
  }

  async atualizarContratoComVersao(id: string, versao: number, data: Prisma.ContratoUpdateManyMutationInput, tx: Cliente = prisma) {
    const r = await tx.contrato.updateMany({ where: { id, versao }, data: { ...data, versao: { increment: 1 } } });
    return r.count;
  }

  buscarContratoPorId(id: string, tx: Cliente = prisma) {
    return tx.contrato.findUnique({ where: { id } });
  }

  // Total de lotes da organização (qualquer status): quem já enviou lotes faz parte do histórico.
  async excluirContratoComVersao(id: string, versao: number, tx: Cliente = prisma) {
    const r = await tx.contrato.deleteMany({ where: { id, versao } });
    return r.count;
  }

  async excluirComVersao(id: string, versao: number, tx: Cliente = prisma) {
    const r = await tx.organizacao.deleteMany({ where: { id, versao } });
    return r.count;
  }
}

// escrito com carinho por Arthur.
