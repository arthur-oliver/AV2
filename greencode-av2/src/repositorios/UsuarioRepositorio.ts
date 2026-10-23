import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { Paginacao } from '../utils/paginacao';
import type { PapelUsuario } from '../dominio/enums';

type Cliente = Prisma.TransactionClient;

// Campos seguros para devolver ao cliente (NUNCA inclui senhaHash).
export const usuarioPublico = {
  id: true,
  usuario: true,
  nome: true,
  papel: true,
  ativo: true,
  ultimoAcesso: true,
  criadoEm: true,
  atualizadoEm: true,
  versao: true
} satisfies Prisma.UsuarioSelect;

// Camada de repositório: único lugar que fala com o banco sobre usuários.
export class UsuarioRepositorio {
  buscarPorLogin(usuario: string) {
    return prisma.usuario.findUnique({ where: { usuario } });
  }

  buscarPorId(id: string, tx: Cliente = prisma) {
    return tx.usuario.findUnique({ where: { id } });
  }

  buscarPublicoPorId(id: string, tx: Cliente = prisma) {
    return tx.usuario.findUnique({ where: { id }, select: usuarioPublico });
  }

  listar(filtro: { papel?: PapelUsuario; ativo?: boolean }, pag: Paginacao) {
    const where: Prisma.UsuarioWhereInput = {};
    if (filtro.papel) where.papel = filtro.papel;
    if (filtro.ativo !== undefined) where.ativo = filtro.ativo;
    return prisma.$transaction([
      prisma.usuario.findMany({ where, select: usuarioPublico, orderBy: { usuario: 'asc' }, skip: pag.skip, take: pag.take }),
      prisma.usuario.count({ where })
    ]);
  }

  criar(dados: Prisma.UsuarioCreateInput, tx: Cliente = prisma) {
    return tx.usuario.create({ data: dados, select: usuarioPublico });
  }

  atualizar(id: string, dados: Prisma.UsuarioUpdateInput, tx: Cliente = prisma) {
    return tx.usuario.update({
      where: { id },
      data: { ...dados, versao: { increment: 1 } },
      select: usuarioPublico
    });
  }

  // Versionamento otimista: retorna quantas linhas foram atualizadas (0 = versão desatualizada).
  async atualizarComVersao(id: string, versao: number, dados: Prisma.UsuarioUpdateManyMutationInput, tx: Cliente = prisma) {
    const r = await tx.usuario.updateMany({ where: { id, versao }, data: { ...dados, versao: { increment: 1 } } });
    return r.count;
  }

  // Trava (SELECT ... FOR UPDATE) as linhas dos usuários ATIVOS de um papel e devolve os ids.
  // Serve para a regra "sempre ao menos 1 ativo": se dois administradores tentarem se desativar ao mesmo
  // tempo, o segundo espera o primeiro terminar e então enxerga o resultado já confirmado.
  // Deve ser chamado DENTRO de uma transação, antes de qualquer outra leitura.
  async bloquearAtivosDoPapel(papel: PapelUsuario, tx: Cliente): Promise<string[]> {
    const linhas = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM usuarios WHERE papel = ${papel} AND ativo = true FOR UPDATE`
    );
    return linhas.map((l) => l.id);
  }

  // Quantas vezes o login aparece no histórico (journal e movimentações de equipamentos).
  // Quem já operou o sistema não pode ser excluído: o histórico de auditoria precisa continuar válido.
  async contarHistorico(login: string, tx: Cliente = prisma): Promise<number> {
    const [journal, movimentacoes] = await Promise.all([
      tx.journalTransacao.count({ where: { usuarioResponsavel: login } }),
      tx.movimentacao.count({ where: { responsavel: login } })
    ]);
    return journal + movimentacoes;
  }

  excluir(id: string, tx: Cliente = prisma) {
    return tx.usuario.delete({ where: { id } });
  }
}

// este trecho tem o dedo do Rossi.
