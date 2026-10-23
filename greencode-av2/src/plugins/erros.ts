import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { AppError } from '../erros/AppError';

// Handler global: toda falha vira uma resposta JSON padronizada { erro, mensagem }.
export function registrarTratamentoErros(app: FastifyInstance): void {
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({ erro: 'ROTA_NAO_ENCONTRADA', mensagem: `Rota ${req.method} ${req.url} não existe.` });
  });

  app.setErrorHandler((error: any, req, reply) => {
    // 1) Erros de negócio lançados pelos services
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ erro: error.codigo, mensagem: error.message });
    }

    // 2) Falha na validação do JSON Schema da rota
    if (error.validation) {
      return reply.status(400).send({ erro: 'VALIDACAO', mensagem: error.message });
    }

    // 3) Erros conhecidos do banco (rede de segurança contra corrida entre requisições)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const alvo = Array.isArray(error.meta?.target) ? (error.meta?.target as string[]).join(', ') : String(error.meta?.target ?? '');
        return reply.status(409).send({ erro: 'CONFLITO', mensagem: `Já existe um registro com este valor único (${alvo}).` });
      }
      if (error.code === 'P2025') {
        return reply.status(404).send({ erro: 'NAO_ENCONTRADO', mensagem: 'Registro não encontrado.' });
      }
      if (error.code === 'P2003') {
        return reply.status(409).send({ erro: 'CONFLITO', mensagem: 'Referência inválida ou registro com dependências.' });
      }
    }

    // Limite geral de requisições (@fastify/rate-limit)
    if (error.statusCode === 429) {
      return reply.status(429).send({ erro: 'MUITAS_REQUISICOES', mensagem: 'Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.' });
    }

    // 4) Erros 4xx do próprio Fastify (ex.: JSON malformado)
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ erro: 'REQUISICAO_INVALIDA', mensagem: error.message });
    }

    // 5) Qualquer outra coisa: loga o detalhe, responde genérico (não vaza informação interna)
    req.log.error(error);
    return reply.status(500).send({ erro: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor.' });
  });
}

// Arthur Oliver Rossi Alves, autor do Greencode.
