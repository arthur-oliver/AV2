import type { FastifyInstance } from 'fastify';
import { RelatorioController } from '../controllers/RelatorioController';
import { GRUPOS } from '../seguranca/permissoes';
import { StatusRastreamento } from '../dominio/enums';

const seguranca = [{ bearerAuth: [] }];
const periodo = {
  inicio: { type: 'string', maxLength: 30, description: 'AAAA-MM-DD (padrão: 90 dias atrás)' },
  fim: { type: 'string', maxLength: 30, description: 'AAAA-MM-DD (padrão: agora)' }
};
const formato = {
  formato: { type: 'string', enum: ['json', 'csv'], description: 'json (padrão) ou csv (arquivo para o Excel)' }
};

export async function rotasRelatorios(app: FastifyInstance): Promise<void> {
  const c = new RelatorioController();
  const leitura = app.autorizar(...GRUPOS.LEITURA);
  const auditoria = app.autorizar(...GRUPOS.AUDITORIA);

  app.get(
    '/relatorios/organizacao/:id',
    {
      preHandler: leitura,
      schema: {
        tags: ['Relatórios'],
        summary: 'Lotes, equipamentos e peso de uma organização no período (?formato=csv baixa em CSV)',
        security: seguranca,
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 36, maxLength: 36 } } },
        querystring: { type: 'object', properties: { ...periodo, ...formato } }
      }
    },
    c.porOrganizacao as never
  );

  app.get(
    '/relatorios/status/:status',
    {
      preHandler: leitura,
      schema: {
        tags: ['Relatórios'],
        summary: 'Equipamentos em um determinado status de rastreamento',
        security: seguranca,
        params: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: Object.values(StatusRastreamento) } } },
        querystring: { type: 'object', properties: formato }
      }
    },
    c.porStatus as never
  );

  app.get(
    '/relatorios/financeiro',
    { preHandler: leitura, schema: { tags: ['Relatórios'], summary: 'Valor mensal dos contratos vigentes no período', security: seguranca, querystring: { type: 'object', properties: { ...periodo, ...formato } } } },
    c.financeiro as never
  );

  app.get(
    '/auditoria',
    {
      preHandler: auditoria,
      schema: {
        tags: ['Auditoria'],
        summary: 'Consulta o journal de operações (admin e auditor)',
        security: seguranca,
        querystring: {
          type: 'object',
          properties: {
            ...periodo,
            ...formato,
            entidade: { type: 'string', maxLength: 40 },
            entidadeId: { type: 'string', maxLength: 36 },
            usuario: { type: 'string', maxLength: 60 },
            limite: { type: 'integer', minimum: 1, maximum: 500 }
          }
        }
      }
    },
    c.auditoria as never
  );
}

// este trecho tem o dedo do Rossi.
