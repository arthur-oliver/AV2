import type { FastifyInstance } from 'fastify';
import { EquipamentoController } from '../controllers/EquipamentoController';
import { GRUPOS } from '../seguranca/permissoes';
import { EstadoFisico, StatusRastreamento, TipoEquipamento } from '../dominio/enums';

const seguranca = [{ bearerAuth: [] }];
const TAG = ['Equipamentos'];
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 36, maxLength: 36 } } };
const versao = { type: 'integer', minimum: 1 };
const versaoQuery = { type: 'object', required: ['versao'], properties: { versao } };

export async function rotasEquipamentos(app: FastifyInstance): Promise<void> {
  const c = new EquipamentoController();
  const leitura = app.autorizar(...GRUPOS.LEITURA);
  const escrita = app.autorizar(...GRUPOS.ESCRITA_ALMOXARIFADO);

  app.get(
    '/equipamentos',
    {
      preHandler: leitura,
      schema: {
        tags: TAG,
        summary: 'Lista equipamentos (filtros: status, tipo, loteId; máx. 500)',
        security: seguranca,
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: Object.values(StatusRastreamento) },
            tipo: { type: 'string', enum: Object.values(TipoEquipamento) },
            loteId: { type: 'string', minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    c.listar as never
  );

  app.get('/equipamentos/:id', { preHandler: leitura, schema: { tags: TAG, summary: 'Detalha um equipamento', security: seguranca, params: idParam } }, c.buscar as never);

  app.get(
    '/equipamentos/:id/rastreamento',
    { preHandler: leitura, schema: { tags: TAG, summary: 'Histórico completo de movimentações (rastreabilidade)', security: seguranca, params: idParam } },
    c.rastrear as never
  );

  app.patch(
    '/equipamentos/:id/status',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Altera o status de rastreamento (justificativa obrigatória; registra movimentação)',
        security: seguranca,
        params: idParam,
        body: {
          type: 'object',
          required: ['status', 'justificativa', 'versao'],
          properties: { status: { type: 'string', enum: Object.values(StatusRastreamento) }, justificativa: { type: 'string', maxLength: 1000 }, versao }
        }
      }
    },
    c.alterarStatus as never
  );

  app.patch(
    '/equipamentos/:id/estado-fisico',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Altera o estado físico (piora de 2+ categorias exige justificativa)',
        security: seguranca,
        params: idParam,
        body: {
          type: 'object',
          required: ['estadoFisico', 'versao'],
          properties: { estadoFisico: { type: 'string', enum: Object.values(EstadoFisico) }, justificativa: { type: 'string', maxLength: 1000 }, versao }
        }
      }
    },
    c.alterarEstadoFisico as never
  );

  app.post(
    '/equipamentos/:id/movimentacoes',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Registra uma movimentação física (sem mudar o status)',
        security: seguranca,
        params: idParam,
        body: { type: 'object', required: ['destino'], properties: { destino: { type: 'string', minLength: 1, maxLength: 120 }, observacao: { type: 'string', maxLength: 1000 } } }
      }
    },
    c.registrarMovimentacao as never
  );

  app.put(
    '/equipamentos/:id',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Corrige dados cadastrais (tipo, marca, modelo, ano, peso). Exige a "versao" atual; o código de barras não muda',
        security: seguranca,
        params: idParam,
        body: {
          type: 'object',
          required: ['versao'],
          properties: {
            tipo: { type: 'string', enum: Object.values(TipoEquipamento) },
            marca: { type: 'string', maxLength: 80 },
            modelo: { type: 'string', maxLength: 80 },
            anoFabricacao: { type: 'integer', minimum: 1970, maximum: 2100 },
            pesoQuilogramas: { type: 'number', exclusiveMinimum: 0, maximum: 99999 },
            versao
          }
        }
      }
    },
    c.atualizar as never
  );

  app.delete(
    '/equipamentos/:id',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Exclusão definitiva do equipamento e das movimentações dele. Informe ?versao=',
        security: seguranca,
        params: idParam,
        querystring: versaoQuery
      }
    },
    c.excluir as never
  );
}

// Alves aprova este código.
