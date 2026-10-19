import type { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/AuthController';

export async function rotasAuth(app: FastifyInstance): Promise<void> {
  const c = new AuthController();

  app.post<{ Body: { usuario: string; senha: string } }>(
    '/auth/login',
    {
      schema: {
        tags: ['Autenticação'],
        summary: 'Login: devolve um token JWT',
        body: {
          type: 'object',
          required: ['usuario', 'senha'],
          properties: {
            usuario: { type: 'string', minLength: 1, maxLength: 60 },
            senha: { type: 'string', minLength: 1, maxLength: 100 }
          }
        }
      }
    },
    c.login
  );

  app.get(
    '/auth/me',
    { preHandler: app.autenticar, schema: { tags: ['Autenticação'], summary: 'Dados do usuário logado', security: [{ bearerAuth: [] }] } },
    c.eu
  );

  app.put<{ Body: { nome: string; versao: number } }>(
    '/auth/perfil',
    {
      preHandler: app.autenticar,
      schema: {
        tags: ['Autenticação'],
        summary: 'Altera o próprio nome de exibição (use "versao" de GET /auth/me)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['nome', 'versao'],
          properties: { nome: { type: 'string', minLength: 2, maxLength: 120 }, versao: { type: 'integer', minimum: 1 } }
        }
      }
    },
    c.atualizarPerfil
  );

  app.post<{ Body: { senhaAtual: string; novaSenha: string } }>(
    '/auth/alterar-senha',
    {
      preHandler: app.autenticar,
      schema: {
        tags: ['Autenticação'],
        summary: 'Altera a própria senha (qualquer usuário logado)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['senhaAtual', 'novaSenha'],
          properties: {
            senhaAtual: { type: 'string', minLength: 1, maxLength: 100 },
            novaSenha: { type: 'string', minLength: 8, maxLength: 72 }
          }
        }
      }
    },
    c.alterarSenha
  );
}

// Oliver passou por aqui.
