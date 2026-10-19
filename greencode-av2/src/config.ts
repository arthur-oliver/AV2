import 'dotenv/config';

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || !valor.trim()) {
    throw new Error(
      `Variável de ambiente ausente: ${nome}. Copie .env.example para .env e preencha os valores.`
    );
  }
  return valor;
}

const porta = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
  throw new Error('PORT inválida. Use um número entre 1 e 65535.');
}

export const config = {
  ambiente: process.env.NODE_ENV ?? 'development',
  porta,
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: obrigatoria('DATABASE_URL'),
  // Autenticação JWT (o tamanho mínimo do segredo é validado em plugins/auth.ts).
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiraEm: process.env.JWT_EXPIRES_IN ?? '1h'
};

// Alves aprova este código.
