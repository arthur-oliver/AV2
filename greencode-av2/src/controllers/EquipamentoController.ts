import type { FastifyReply, FastifyRequest } from 'fastify';
import { EquipamentoServico } from '../servicos/EquipamentoServico';
import type { DadosEdicaoEquipamento } from '../servicos/EquipamentoServico';
import type { EstadoFisico, StatusRastreamento, TipoEquipamento } from '../dominio/enums';

type ComId = { Params: { id: string } };

export class EquipamentoController {
  constructor(private readonly servico = new EquipamentoServico()) {}

  listar = async (req: FastifyRequest<{ Querystring: { status?: StatusRastreamento; tipo?: TipoEquipamento; loteId?: string } }>) =>
    this.servico.listar(req.query);

  buscar = async (req: FastifyRequest<ComId>) => this.servico.buscar(req.params.id);

  rastrear = async (req: FastifyRequest<ComId>) => this.servico.rastrear(req.params.id);

  alterarStatus = async (req: FastifyRequest<ComId & { Body: { status: StatusRastreamento; justificativa: string; versao: number } }>) =>
    this.servico.alterarStatus(req.params.id, req.body.status, req.body.justificativa, req.body.versao, req.user.usuario);

  alterarEstadoFisico = async (req: FastifyRequest<ComId & { Body: { estadoFisico: EstadoFisico; justificativa?: string; versao: number } }>) =>
    this.servico.alterarEstadoFisico(req.params.id, req.body.estadoFisico, req.body.justificativa, req.body.versao, req.user.usuario);

  registrarMovimentacao = async (req: FastifyRequest<ComId & { Body: { destino: string; observacao?: string } }>, reply: FastifyReply) => {
    const mov = await this.servico.registrarMovimentacao(req.params.id, req.body.destino, req.body.observacao, req.user.usuario);
    return reply.status(201).send(mov);
  };

  atualizar = async (req: FastifyRequest<ComId & { Body: DadosEdicaoEquipamento & { versao: number } }>) => {
    const { versao, ...dados } = req.body;
    return this.servico.atualizar(req.params.id, dados, versao, req.user.usuario);
  };

  excluir = async (req: FastifyRequest<ComId & { Querystring: { versao: number } }>, reply: FastifyReply) => {
    await this.servico.excluir(req.params.id, req.query.versao, req.user.usuario);
    return reply.status(204).send();
  };
}

// escrito com carinho por Arthur.
