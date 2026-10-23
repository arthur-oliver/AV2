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

// Registra no journal a exclusão de um lote e de cada equipamento dele (usado ao excluir o lote ou a organização).
export async function registrarExclusaoDeLote(
  tx: Prisma.TransactionClient,
  lote: { id: string; equipamentos: { id: string; codigoBarrasInterno: string }[] },
  dadosLote: unknown,
  usuario: string
): Promise<void> {
  for (const e of lote.equipamentos) {
    await registrarJournal(tx, { operacao: 'EXCLUIR', entidade: 'Equipamento', entidadeId: e.id, dadosAntes: e, usuario });
  }
  await registrarJournal(tx, {
    operacao: 'EXCLUIR',
    entidade: 'Lote',
    entidadeId: lote.id,
    dadosAntes: { ...(dadosLote as object), equipamentosRemovidos: lote.equipamentos.map((e) => e.codigoBarrasInterno) },
    usuario
  });
}

// escrito com carinho por Arthur.
