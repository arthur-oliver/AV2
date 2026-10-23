import { paginacaoQuery } from '../utils/paginacao';
import type { FastifyInstance } from 'fastify';
import { UsuarioController } from '../controllers/UsuarioController';
import { GRUPOS } from '../seguranca/permissoes';
import { PapelUsuario } from '../dominio/enums';

// O papel SUPERUSUARIO é único e não pode ser criado nem atribuído pela API.
const PAPEIS_ATRIBUIVEIS = Object.values(PapelUsuario).filter((p) => p !== PapelUsuario.SUPERUSUARIO);

const TAG = ['Usuários'];
const seguranca = [{ bearerAuth: [] }];
const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 36, maxLength: 36 } }
};

export async function rotasUsuarios(app: FastifyInstance): Promise<void> {
  const c = new UsuarioController();
  const soSuper = app.autorizar(...GRUPOS.SOMENTE_SUPERUSUARIO);

  app.get(
    '/usuarios',
    {
      preHandler: soSuper,
      schema: {
        tags: TAG,
        summary: 'Lista usuários (superusuário). Filtros opcionais: papel, ativo',
        security: seguranca,
        querystring: {
          type: 'object',
          properties: { papel: { type: 'string', enum: Object.values(PapelUsuario) }, ativo: { type: 'boolean' }, ...paginacaoQuery }
        }
      }
    },
    c.listar as never
  );

  app.get('/usuarios/:id', { preHandler: soSuper, schema: { tags: TAG, summary: 'Detalha um usuário (superusuário)', security: seguranca, params: idParam } }, c.buscar as never);

  app.post(
    '/usuarios',
    {
      preHandler: soSuper,
      schema: {
        tags: TAG,
        summary: 'Cria usuário (superusuário)',
        security: seguranca,
        body: {
          type: 'object',
          required: ['usuario', 'senha', 'papel'],
          properties: {
            usuario: { type: 'string', minLength: 3, maxLength: 60, pattern: '^[A-Za-z0-9._-]+$' },
            nome: { type: 'string', minLength: 2, maxLength: 120 },
            senha: { type: 'string', minLength: 8, maxLength: 72 },
            papel: { type: 'string', enum: PAPEIS_ATRIBUIVEIS }
          }
        }
      }
    },
    c.criar as never
  );

  app.put(
    '/usuarios/:id',
    {
      preHandler: soSuper,
      schema: {
        tags: TAG,
        summary: 'Troca o papel de um usuário (superusuário). Sempre deve sobrar 1 ativo no papel anterior; não vale para si mesmo',
        security: seguranca,
        params: idParam,
        body: {
          type: 'object',
          required: ['papel', 'versao'],
          properties: { papel: { type: 'string', enum: PAPEIS_ATRIBUIVEIS }, versao: { type: 'integer', minimum: 1 } }
        }
      }
    },
    c.alterarPapel as never
  );

  app.patch(
    '/usuarios/:id/nome',
    {
      preHandler: soSuper,
      schema: {
        tags: TAG,
        summary: 'Altera o nome de exibição de um usuário (superusuário). O login não muda',
        security: seguranca,
        params: idParam,
        body: {
          type: 'object',
          required: ['nome', 'versao'],
          properties: { nome: { type: 'string', minLength: 2, maxLength: 120 }, versao: { type: 'integer', minimum: 1 } }
        }
      }
    },
    c.atualizarNome as never
  );

  app.patch(
    '/usuarios/:id/ativo',
    {
      preHandler: soSuper,
      schema: {
        tags: TAG,
        summary: 'Ativa ou desativa um usuário (superusuário). Não desativa a si mesmo nem o último ativo de um papel essencial',
        security: seguranca,
        params: idParam,
        body: { type: 'object', required: ['ativo'], properties: { ativo: { type: 'boolean' } } }
      }
    },
    c.alterarAtivo as never
  );

  app.post(
    '/usuarios/:id/redefinir-senha',
    {
      preHandler: soSuper,
      schema: {
        tags: TAG,
        summary: 'Define uma nova senha para o usuário (superusuário). Também libera um login bloqueado por tentativas',
        security: seguranca,
        params: idParam,
        body: { type: 'object', required: ['novaSenha'], properties: { novaSenha: { type: 'string', minLength: 8, maxLength: 72 } } }
      }
    },
    c.redefinirSenha as never
  );

  app.delete(
    '/usuarios/:id',
    {
      preHandler: soSuper,
      schema: {
        tags: TAG,
        summary: 'Exclui um usuário SEM histórico (superusuário). Quem já operou o sistema deve ser apenas desativado',
        security: seguranca,
        params: idParam
      }
    },
    c.excluir as never
  );
}

// Oliver passou por aqui.
