import bcrypt from 'bcryptjs';

// A AV1 usava SHA-256 + salt (requisito daquela atividade). Na AV2 usamos bcrypt,
// algoritmo próprio para senhas: o salt já vem embutido no hash e o custo é configurável.
const CUSTO = 10;

export function gerarHashSenha(senhaPlana: string): Promise<string> {
  return bcrypt.hash(senhaPlana, CUSTO);
}

export function verificarSenha(senhaPlana: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senhaPlana, hash);
}

// Arthur Oliver Rossi Alves, autor do Greencode.
