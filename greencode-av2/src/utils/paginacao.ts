import type { FastifyReply } from 'fastify';

// Paginação das listagens: ?pagina=1&limite=100. A resposta continua sendo a lista (array) e o total
// vai nos cabeçalhos X-Total-Count, X-Pagina e X-Limite.
const LIMITE_PADRAO = 100;
const LIMITE_MAXIMO = 500;

export const paginacaoQuery = {
  pagina: { type: 'integer', minimum: 1, description: 'Página (padrão: 1)' },
  limite: { type: 'integer', minimum: 1, maximum: LIMITE_MAXIMO, description: `Itens por página (padrão ${LIMITE_PADRAO}, máx. ${LIMITE_MAXIMO})` }
} as const;

export interface Paginacao {
  pagina: number;
  limite: number;
  skip: number;
  take: number;
}

export function lerPaginacao(q: { pagina?: number; limite?: number } = {}): Paginacao {
  const pagina = q.pagina && q.pagina > 0 ? q.pagina : 1;
  const limite = Math.min(q.limite && q.limite > 0 ? q.limite : LIMITE_PADRAO, LIMITE_MAXIMO);
  return { pagina, limite, skip: (pagina - 1) * limite, take: limite };
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  limite: number;
}

// Monta o resultado de uma listagem paginada a partir do que o repositório devolveu.
export function montarPagina<T>(itens: T[], total: number, pag: Paginacao): Pagina<T> {
  return { itens, total, pagina: pag.pagina, limite: pag.limite };
}

// Coloca o total nos cabeçalhos e devolve só a lista.
export function responderPagina<T>(reply: FastifyReply, p: Pagina<T>): T[] {
  reply.header('X-Total-Count', String(p.total)).header('X-Pagina', String(p.pagina)).header('X-Limite', String(p.limite));
  return p.itens;
}

// Arthur Oliver Rossi Alves, autor do Greencode.
