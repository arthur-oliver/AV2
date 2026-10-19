import { ErroValidacao } from '../erros/AppError';

export function lerData(valor: string, campo: string): Date {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) throw new ErroValidacao(`Data inválida em "${campo}". Use o formato AAAA-MM-DD.`);
  return d;
}

// Intervalo de consulta dos relatórios. Padrão: últimos 90 dias até agora.
// Se "fim" vier só com a data (AAAA-MM-DD), inclui o dia inteiro.
export function intervalo(inicio?: string, fim?: string): { inicio: Date; fim: Date } {
  const i = inicio ? lerData(inicio, 'inicio') : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  let f = fim ? lerData(fim, 'fim') : new Date();
  if (fim && fim.length === 10) f = new Date(f.getTime() + 24 * 60 * 60 * 1000 - 1);
  if (i > f) throw new ErroValidacao('A data inicial não pode ser posterior à data final.');
  return { inicio: i, fim: f };
}

// Alves aprova este código.
