import type { FastifyReply, FastifyRequest } from 'fastify';
import { responderPagina } from '../utils/paginacao';
import { OrganizacaoServico } from '../servicos/OrganizacaoServico';
import type { DadosAtualizacao, DadosContrato, DadosOrganizacao } from '../servicos/OrganizacaoServico';

type ComId = { Params: { id: string } };

export class OrganizacaoController {
  constructor(private readonly servico = new OrganizacaoServico()) {}

  listar = async (req: FastifyRequest<{ Querystring: { ativo?: boolean; busca?: string; pagina?: number; limite?: number } }>, reply: FastifyReply) =>
    responderPagina(reply, await this.servico.listar({ ...req.query, busca: req.query.busca?.trim() || undefined }));

  buscar = async (req: FastifyRequest<ComId>) => this.servico.buscar(req.params.id);

  criar = async (req: FastifyRequest<{ Body: DadosOrganizacao }>, reply: FastifyReply) => {
    const criada = await this.servico.criar(req.body, req.user.usuario);
    return reply.status(201).send(criada);
  };

  atualizar = async (req: FastifyRequest<ComId & { Body: DadosAtualizacao }>) =>
    this.servico.atualizar(req.params.id, req.body, req.user.usuario);

  alterarAtivo = async (req: FastifyRequest<ComId & { Body: { ativo: boolean; versao: number } }>) =>
    this.servico.alterarAtivo(req.params.id, req.body.ativo, req.body.versao, req.user.usuario);

  definirContrato = async (req: FastifyRequest<ComId & { Body: DadosContrato & { versao?: number } }>) => {
    const { versao, ...contrato } = req.body;
    return this.servico.definirContrato(req.params.id, contrato, versao, req.user.usuario);
  };

  renovarContrato = async (req: FastifyRequest<ComId & { Body: { novoVencimento: string; versao: number } }>) =>
    this.servico.renovarContrato(req.params.id, req.body.novoVencimento, req.body.versao, req.user.usuario);

  removerContrato = async (req: FastifyRequest<ComId & { Querystring: { versao: number } }>) =>
    this.servico.removerContrato(req.params.id, req.query.versao, req.user.usuario);

  excluir = async (req: FastifyRequest<ComId & { Querystring: { versao: number } }>, reply: FastifyReply) => {
    await this.servico.excluir(req.params.id, req.query.versao, req.user.usuario);
    return reply.status(204).send();
  };
}

// Oliver passou por aqui.
