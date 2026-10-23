import type { FastifyInstance } from 'fastify';
import { OrganizacaoController } from '../controllers/OrganizacaoController';
import { GRUPOS } from '../seguranca/permissoes';

const seguranca = [{ bearerAuth: [] }];
const TAG = ['Organizações'];

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 36, maxLength: 36 } }
};

const versao = { type: 'integer', minimum: 1 };
const versaoQuery = { type: 'object', required: ['versao'], properties: { versao } };

const contratoProps = {
  dataAssinatura: { type: 'string', minLength: 10, maxLength: 30 },
  dataVencimento: { type: 'string', minLength: 10, maxLength: 30 },
  clausulas: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 1000 }, maxItems: 100 },
  valorMensal: { type: 'number', minimum: 0, maximum: 99999999.99 },
  renovacaoAutomatica: { type: 'boolean' }
};

const camposOrganizacao = {
  razaoSocial: { type: 'string', minLength: 2, maxLength: 200 },
  inscricaoEstadual: { type: 'string', maxLength: 30 },
  enderecoCompleto: { type: 'string', maxLength: 1000 },
  telefone: { type: 'string', maxLength: 30 },
  email: { type: 'string', maxLength: 150, format: 'email' }
};

export async function rotasOrganizacoes(app: FastifyInstance): Promise<void> {
  const c = new OrganizacaoController();
  const leitura = app.autorizar(...GRUPOS.LEITURA);
  const escrita = app.autorizar(...GRUPOS.ESCRITA_CADASTRO);

  app.get(
    '/organizacoes',
    {
      preHandler: leitura,
      schema: {
        tags: TAG,
        summary: 'Lista organizações (filtros: ativo, busca por razão social/CNPJ)',
        security: seguranca,
        querystring: { type: 'object', properties: { ativo: { type: 'boolean' }, busca: { type: 'string', maxLength: 100 } } }
      }
    },
    c.listar as never
  );

  app.get(
    '/organizacoes/:id',
    { preHandler: leitura, schema: { tags: TAG, summary: 'Detalha uma organização (com contrato)', security: seguranca, params: idParam } },
    c.buscar as never
  );

  app.post(
    '/organizacoes',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Cadastra organização (contrato é opcional)',
        security: seguranca,
        body: {
          type: 'object',
          required: ['razaoSocial', 'cnpj'],
          properties: {
            ...camposOrganizacao,
            cnpj: { type: 'string', minLength: 14, maxLength: 18 },
            contrato: { type: 'object', required: ['dataVencimento', 'clausulas', 'valorMensal'], properties: contratoProps }
          }
        }
      }
    },
    c.criar as never
  );

  app.put(
    '/organizacoes/:id',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Atualiza dados da organização (exige a "versao" atual; CNPJ não muda)',
        security: seguranca,
        params: idParam,
        body: { type: 'object', required: ['versao'], properties: { ...camposOrganizacao, versao } }
      }
    },
    c.atualizar as never
  );

  app.patch(
    '/organizacoes/:id/ativo',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Soft delete: ativa/inativa a organização (ao inativar, inativa em cadeia os lotes e equipamentos)',
        security: seguranca,
        params: idParam,
        body: { type: 'object', required: ['ativo', 'versao'], properties: { ativo: { type: 'boolean' }, versao } }
      }
    },
    c.alterarAtivo as never
  );

  app.put(
    '/organizacoes/:id/contrato',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Cria o contrato ou substitui o existente (neste caso envie "versao" do contrato)',
        security: seguranca,
        params: idParam,
        body: { type: 'object', required: ['dataVencimento', 'clausulas', 'valorMensal'], properties: { ...contratoProps, versao } }
      }
    },
    c.definirContrato as never
  );

  app.patch(
    '/organizacoes/:id/contrato/renovar',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Renova o contrato (novo vencimento deve ser posterior ao atual)',
        security: seguranca,
        params: idParam,
        body: {
          type: 'object',
          required: ['novoVencimento', 'versao'],
          properties: { novoVencimento: { type: 'string', minLength: 10, maxLength: 30 }, versao }
        }
      }
    },
    c.renovarContrato as never
  );

  app.delete(
    '/organizacoes/:id/contrato',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Remove o contrato (sem contrato ativo a organização não recebe novos lotes). Informe ?versao= do contrato',
        security: seguranca,
        params: idParam,
        querystring: versaoQuery
      }
    },
    c.removerContrato as never
  );

  app.delete(
    '/organizacoes/:id',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Exclusão definitiva em cadeia: remove a organização, o contrato, os lotes, equipamentos e movimentações. Informe ?versao=',
        security: seguranca,
        params: idParam,
        querystring: versaoQuery
      }
    },
    c.excluir as never
  );
}

// escrito com carinho por Arthur.
