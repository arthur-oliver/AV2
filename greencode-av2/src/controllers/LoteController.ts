import type { FastifyReply, FastifyRequest } from 'fastify';
import { LoteServico } from '../servicos/LoteServico';
import type { DadosEdicaoLote, DadosLote, NovoEquipamento } from '../servicos/LoteServico';
import type { StatusLote } from '../dominio/enums';

type ComId = { Params: { id: string } };

export class LoteController {
  constructor(private readonly servico = new LoteServico()) {}

  listar = async (req: FastifyRequest<{ Querystring: { organizacaoId?: string; status?: StatusLote; inicio?: string; fim?: string } }>) =>
    this.servico.listar(req.query);

  buscar = async (req: FastifyRequest<ComId>) => this.servico.buscar(req.params.id);

  criar = async (req: FastifyRequest<{ Body: DadosLote }>, reply: FastifyReply) => {
    const lote = await this.servico.criar(req.body, req.user.usuario);
    return reply.status(201).send(lote);
  };

  adicionarEquipamentos = async (req: FastifyRequest<ComId & { Body: { versao: number; equipamentos: NovoEquipamento[] } }>, reply: FastifyReply) => {
    const lote = await this.servico.adicionarEquipamentos(req.params.id, req.body.versao, req.body.equipamentos, req.user.usuario);
    return reply.status(201).send(lote);
  };

  processarTriagem = async (req: FastifyRequest<ComId & { Body: { versao: number } }>) =>
    this.servico.processarTriagem(req.params.id, req.body.versao, req.user.usuario);

  avancarStatus = async (req: FastifyRequest<ComId & { Body: { status: StatusLote; versao: number } }>) =>
    this.servico.avancarStatus(req.params.id, req.body.status, req.body.versao, req.user.usuario);

  atualizar = async (req: FastifyRequest<ComId & { Body: DadosEdicaoLote & { versao: number } }>) => {
    const { versao, ...dados } = req.body;
    return this.servico.atualizar(req.params.id, dados, versao, req.user.usuario);
  };

  excluir = async (req: FastifyRequest<ComId & { Querystring: { versao: number } }>, reply: FastifyReply) => {
    await this.servico.excluir(req.params.id, req.query.versao, req.user.usuario);
    return reply.status(204).send();
  };
}

// este trecho tem o dedo do Rossi.
