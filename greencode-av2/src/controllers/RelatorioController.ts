import type { FastifyReply, FastifyRequest } from 'fastify';
import { RelatorioServico } from '../servicos/RelatorioServico';
import type { StatusRastreamento } from '../dominio/enums';
import { csvAuditoria, csvFinanceiro, csvPorOrganizacao, csvPorStatus } from '../servicos/RelatorioCsv';

type Periodo = { inicio?: string; fim?: string; formato?: 'json' | 'csv'; incluirInativos?: boolean };

// Com ?formato=csv a resposta vira um arquivo para download (abre no Excel); sem ele, JSON como sempre.
function enviarCsv(reply: FastifyReply, nomeArquivo: string, conteudo: string) {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.csv"`)
    .send(conteudo);
}

export class RelatorioController {
  constructor(private readonly servico = new RelatorioServico()) {}

  porOrganizacao = async (req: FastifyRequest<{ Params: { id: string }; Querystring: Periodo }>, reply: FastifyReply) => {
    const r = await this.servico.porOrganizacao(req.params.id, req.query.inicio, req.query.fim, req.query.incluirInativos);
    return req.query.formato === 'csv' ? enviarCsv(reply, 'relatorio-organizacao', csvPorOrganizacao(r)) : r;
  };

  porStatus = async (
    req: FastifyRequest<{ Params: { status: StatusRastreamento }; Querystring: { formato?: 'json' | 'csv'; incluirInativos?: boolean } }>,
    reply: FastifyReply
  ) => {
    const r = await this.servico.porStatus(req.params.status, req.query.incluirInativos);
    return req.query.formato === 'csv' ? enviarCsv(reply, `relatorio-status-${req.params.status.toLowerCase()}`, csvPorStatus(r)) : r;
  };

  financeiro = async (req: FastifyRequest<{ Querystring: Periodo }>, reply: FastifyReply) => {
    const r = await this.servico.financeiro(req.query.inicio, req.query.fim);
    return req.query.formato === 'csv' ? enviarCsv(reply, 'relatorio-financeiro', csvFinanceiro(r)) : r;
  };

  auditoria = async (
    req: FastifyRequest<{ Querystring: Periodo & { entidade?: string; entidadeId?: string; usuario?: string; limite?: number } }>,
    reply: FastifyReply
  ) => {
    const r = await this.servico.auditoria(req.query);
    return req.query.formato === 'csv' ? enviarCsv(reply, 'auditoria', csvAuditoria(r)) : r;
  };
}

// Alves aprova este código.
