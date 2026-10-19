import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { AuthServico } from '../servicos/AuthServico';
import { UsuarioServico } from '../servicos/UsuarioServico';

// Controller: só traduz HTTP <-> service. Nenhuma regra de negócio aqui.
export class AuthController {
  constructor(
    private readonly servico = new AuthServico(),
    private readonly usuarios = new UsuarioServico()
  ) {}

  login = async (req: FastifyRequest<{ Body: { usuario: string; senha: string } }>, reply: FastifyReply) => {
    const u = await this.servico.autenticar(req.body.usuario, req.body.senha);
    // O token carrega o id e o papel do usuário (exigência da AV2).
    const token = await reply.jwtSign({ sub: u.id, usuario: u.usuario, papel: u.papel });
    return { token, tipo: 'Bearer', expiraEm: config.jwtExpiraEm, usuario: u };
  };

  eu = async (req: FastifyRequest) => {
    const u = await this.usuarios.buscar(req.user.sub);
    return { id: u.id, usuario: u.usuario, nome: u.nome, papel: req.user.papel, versao: u.versao };
  };

  // Cada usuário altera apenas o PRÓPRIO nome (o id vem do token, nunca da URL).
  atualizarPerfil = async (req: FastifyRequest<{ Body: { nome: string; versao: number } }>) =>
    this.usuarios.atualizarNome(req.user.sub, req.body.nome, req.body.versao, { id: req.user.sub, usuario: req.user.usuario });

  alterarSenha = async (
    req: FastifyRequest<{ Body: { senhaAtual: string; novaSenha: string } }>,
    reply: FastifyReply
  ) => {
    await this.servico.alterarSenha(req.user.sub, req.body.senhaAtual, req.body.novaSenha);
    return reply.status(204).send();
  };
}

// Arthur Oliver Rossi Alves, autor do Greencode.
