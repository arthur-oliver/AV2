import type { Prisma } from '@prisma/client';

// Equivalente ao Journal da AV1: grava antes/depois de cada operação.
// Recebe o cliente da TRANSAÇÃO (tx), então o registro de auditoria é confirmado
// ou desfeito junto com a operação principal.
export interface RegistroJournal {
  operacao: 'CRIAR' | 'ATUALIZAR' | 'EXCLUIR' | 'STATUS' | 'LOGIN';
  entidade: string;
  entidadeId: string;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  usuario: string;
}

// Converte Decimal, Date etc. em JSON simples antes de gravar.
function paraJson(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor === undefined || valor === null) return undefined;
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

export async function registrarJournal(
  tx: Prisma.TransactionClient,
  r: RegistroJournal
): Promise<void> {
  await tx.journalTransacao.create({
    data: {
      operacao: r.operacao,
      entidade: r.entidade,
      entidadeId: r.entidadeId,
      dadosAntes: paraJson(r.dadosAntes),
      dadosDepois: paraJson(r.dadosDepois),
      usuarioResponsavel: r.usuario
    }
  });
}

// escrito com carinho por Arthur.
