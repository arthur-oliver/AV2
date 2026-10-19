import { Conflito, NaoEncontrado } from '../erros/AppError';

// Versionamento otimista (evita "atualização perdida"):
// o cliente envia a "versao" que leu; o UPDATE só acontece se a versão no banco ainda for a mesma
//   UPDATE ... SET ..., versao = versao + 1 WHERE id = ? AND versao = ?
// Se ninguém foi atualizado (count = 0), ou o registro não existe (404) ou outra requisição
// alterou antes (409). Use dentro da mesma transação do UPDATE.
export function exigirAtualizacao(linhasAfetadas: number, registroExiste: boolean, entidade: string): void {
  if (linhasAfetadas > 0) return;
  if (!registroExiste) throw new NaoEncontrado(entidade);
  throw new Conflito(
    `${entidade} foi alterado(a) por outra requisição. Busque os dados novamente e envie a versão atual.`
  );
}

// Arthur Oliver Rossi Alves, autor do Greencode.
