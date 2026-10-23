import type { FastifyInstance } from 'fastify';
import { LoteController } from '../controllers/LoteController';
import { GRUPOS } from '../seguranca/permissoes';
import { EstadoFisico, StatusLote, TipoEquipamento } from '../dominio/enums';
import { paginacaoQuery } from '../utils/paginacao';

const seguranca = [{ bearerAuth: [] }];
const TAG = ['Lotes'];
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 36, maxLength: 36 } } };
const versao = { type: 'integer', minimum: 1 };
const versaoQuery = { type: 'object', required: ['versao'], properties: { versao } };

export const itemEquipamento = {
  type: 'object',
  required: ['tipo', 'anoFabricacao', 'pesoQuilogramas'],
  properties: {
    tipo: { type: 'string', enum: Object.values(TipoEquipamento) },
    marca: { type: 'string', maxLength: 80 },
    modelo: { type: 'string', maxLength: 80 },
    anoFabricacao: { type: 'integer', minimum: 1970, maximum: 2100 },
    estadoFisico: { type: 'string', enum: Object.values(EstadoFisico) },
    pesoQuilogramas: { type: 'number', exclusiveMinimum: 0, maximum: 99999 }
  }
};

export async function rotasLotes(app: FastifyInstance): Promise<void> {
  const c = new LoteController();
  const leitura = app.autorizar(...GRUPOS.LEITURA);
  const escrita = app.autorizar(...GRUPOS.ESCRITA_ALMOXARIFADO);

  app.get(
    '/lotes',
    {
      preHandler: leitura,
      schema: {
        tags: TAG,
        summary: 'Lista lotes (filtros: organizacaoId, status, ativo, período inicio/fim)',
        security: seguranca,
        querystring: {
          type: 'object',
          properties: {
            organizacaoId: { type: 'string', minLength: 36, maxLength: 36 },
            status: { type: 'string', enum: Object.values(StatusLote) },
            ativo: { type: 'boolean' },
            inicio: { type: 'string', maxLength: 30 },
            fim: { type: 'string', maxLength: 30 },
            ...paginacaoQuery
          }
        }
      }
    },
    c.listar as never
  );

  app.get('/lotes/:id', { preHandler: leitura, schema: { tags: TAG, summary: 'Detalha um lote com equipamentos e resumo', security: seguranca, params: idParam } }, c.buscar as never);

  app.post(
    '/lotes',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Registra a chegada de um lote (equipamentos opcionais, tudo numa transação)',
        security: seguranca,
        body: {
          type: 'object',
          required: ['organizacaoId', 'notaFiscal', 'transportadora'],
          properties: {
            organizacaoId: { type: 'string', minLength: 36, maxLength: 36 },
            notaFiscal: { type: 'string', minLength: 1, maxLength: 60 },
            transportadora: { type: 'string', minLength: 1, maxLength: 120 },
            dataEntrada: { type: 'string', maxLength: 30 },
            observacoes: { type: 'string', maxLength: 2000 },
            equipamentos: { type: 'array', items: itemEquipamento, maxItems: 500 }
          }
        }
      }
    },
    c.criar as never
  );

  app.post(
    '/lotes/:id/equipamentos',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Adiciona equipamentos a um lote RECEBIDO (exige a "versao" atual do lote)',
        security: seguranca,
        params: idParam,
        body: { type: 'object', required: ['versao', 'equipamentos'], properties: { versao, equipamentos: { type: 'array', items: itemEquipamento, minItems: 1, maxItems: 500 } } }
      }
    },
    c.adicionarEquipamentos as never
  );

  app.post(
    '/lotes/:id/triagem',
    {
      preHandler: escrita,
      schema: { tags: TAG, summary: 'Processa a triagem: equipamentos vão a EM_TRIAGEM e o lote a TRIAGEM_CONCLUIDA. Depois disso o status do lote é derivado dos equipamentos', security: seguranca, params: idParam, body: { type: 'object', required: ['versao'], properties: { versao } } }
    },
    c.processarTriagem as never
  );

  app.patch(
    '/lotes/:id/ativo',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Soft delete: inativa ou reativa o lote (e, com ele, seus equipamentos). Exige a "versao"',
        security: seguranca,
        params: idParam,
        body: { type: 'object', required: ['ativo', 'versao'], properties: { ativo: { type: 'boolean' }, versao } }
      }
    },
    c.alterarAtivo as never
  );

  app.put(
    '/lotes/:id',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Corrige nota fiscal, transportadora, observações ou data de entrada (esta só antes da triagem). Exige a "versao"',
        security: seguranca,
        params: idParam,
        body: {
          type: 'object',
          required: ['versao'],
          properties: {
            notaFiscal: { type: 'string', minLength: 1, maxLength: 60 },
            transportadora: { type: 'string', minLength: 1, maxLength: 120 },
            dataEntrada: { type: 'string', maxLength: 30 },
            observacoes: { type: 'string', maxLength: 2000 },
            versao
          }
        }
      }
    },
    c.atualizar as never
  );

  app.delete(
    '/lotes/:id',
    {
      preHandler: escrita,
      schema: {
        tags: TAG,
        summary: 'Exclusão definitiva em cadeia: remove o lote, seus equipamentos e movimentações (qualquer status). Informe ?versao=',
        security: seguranca,
        params: idParam,
        querystring: versaoQuery
      }
    },
    c.excluir as never
  );
}

// Arthur Oliver Rossi Alves, autor do Greencode.
