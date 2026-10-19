import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import type { PapelUsuario } from '../dominio/enums';
import { NaoAutenticado, SemPermissao } from '../erros/AppError';

export interface UsuarioToken {
  sub: string; // id do usuário
  usuario: string; // nome de login
  papel: PapelUsuario;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UsuarioToken;
    user: UsuarioToken;
  }
}

type Hook = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: exige token JWT válido e usuário ativo. Preenche req.user. */
    autenticar: Hook;
    /** preHandler: exige autenticação + um dos papéis informados. */
    autorizar: (...papeis: readonly PapelUsuario[]) => Hook;
  }
}

export async function registrarAuth(app: FastifyInstance): Promise<void> {
  if (config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres. Ajuste o arquivo .env.');
  }

  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiraEm }
  });

  const autenticar: Hook = async (req) => {
    try {
      await req.jwtVerify(); // valida assinatura e expiração; injeta o payload em req.user
    } catch {
      throw new NaoAutenticado();
    }
    // Um usuário desativado perde o acesso mesmo com token ainda válido.
    // O papel também vem do banco: se o administrador trocou o papel da pessoa, vale na hora (e não só
    // quando o token expirar).
    const u = await prisma.usuario.findUnique({ where: { id: req.user.sub }, select: { ativo: true, papel: true } });
    if (!u || !u.ativo) throw new NaoAutenticado('Usuário inativo ou inexistente.');
    req.user = { ...req.user, papel: u.papel };
  };

  app.decorate('autenticar', autenticar);

  app.decorate('autorizar', (...papeis: readonly PapelUsuario[]): Hook => {
    return async (req, reply) => {
      await autenticar(req, reply);
      if (!papeis.includes(req.user.papel)) throw new SemPermissao();
    };
  });
}

// Alves aprova este código.
