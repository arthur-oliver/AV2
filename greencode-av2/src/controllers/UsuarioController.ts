import { responderPagina } from '../utils/paginacao';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UsuarioServico } from '../servicos/UsuarioServico';
import type { PapelUsuario } from '../dominio/enums';

type ComId = { Params: { id: string } };

export class UsuarioController {
  constructor(private readonly servico = new UsuarioServico()) {}

  listar = async (req: FastifyRequest<{ Querystring: { papel?: PapelUsuario; ativo?: boolean; pagina?: number; limite?: number } }>, reply: FastifyReply) =>
    responderPagina(reply, await this.servico.listar(req.query));

  buscar = async (req: FastifyRequest<ComId>) => this.servico.buscar(req.params.id);

  criar = async (
    req: FastifyRequest<{ Body: { usuario: string; nome?: string; senha: string; papel: PapelUsuario } }>,
    reply: FastifyReply
  ) => {
    const criado = await this.servico.criar(req.body, req.user.usuario);
    return reply.status(201).send(criado);
  };

  alterarPapel = async (req: FastifyRequest<ComId & { Body: { papel: PapelUsuario; versao: number } }>) =>
    this.servico.alterarPapel(req.params.id, req.body.papel, req.body.versao, { id: req.user.sub, usuario: req.user.usuario });

  atualizarNome = async (req: FastifyRequest<ComId & { Body: { nome: string; versao: number } }>) =>
    this.servico.atualizarNome(req.params.id, req.body.nome, req.body.versao, { id: req.user.sub, usuario: req.user.usuario });

  alterarAtivo = async (req: FastifyRequest<ComId & { Body: { ativo: boolean } }>) => {
    return this.servico.alterarAtivo(req.params.id, req.body.ativo, { id: req.user.sub, usuario: req.user.usuario });
  };

  redefinirSenha = async (req: FastifyRequest<ComId & { Body: { novaSenha: string } }>, reply: FastifyReply) => {
    await this.servico.redefinirSenha(req.params.id, req.body.novaSenha, { id: req.user.sub, usuario: req.user.usuario });
    return reply.status(204).send();
  };

  excluir = async (req: FastifyRequest<ComId>, reply: FastifyReply) => {
    await this.servico.excluir(req.params.id, { id: req.user.sub, usuario: req.user.usuario });
    return reply.status(204).send();
  };
}

// Arthur Oliver Rossi Alves, autor do Greencode.
