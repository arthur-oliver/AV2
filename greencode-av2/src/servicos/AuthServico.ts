import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { UsuarioRepositorio } from '../repositorios/UsuarioRepositorio';
import { gerarHashSenha, verificarSenha } from '../seguranca/senha';
import { MuitasTentativas, NaoAutenticado, RegraNegocio } from '../erros/AppError';
import { controleLogin } from '../seguranca/tentativasLogin';
import { registrarJournal } from '../utils/auditoria';

// Hash fictício (gerado na inicialização): usado quando o usuário não existe, para o tempo de
// resposta ser parecido nos dois casos (dificulta descobrir quais logins existem).
const HASH_FICTICIO = bcrypt.hashSync('senha-ficticia', 10);

export function validarForcaSenha(senha: string): void {
  if (senha.length < 8 || senha.length > 72 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    throw new RegraNegocio('A senha deve ter de 8 a 72 caracteres, com ao menos uma letra e um número.');
  }
}

export class AuthServico {
  constructor(private readonly usuarios = new UsuarioRepositorio()) {}

  // A assinatura do JWT é feita no controller (precisa da instância do Fastify).
  async autenticar(login: string, senha: string) {
    // Bloqueio temporário depois de várias falhas seguidas (proteção contra adivinhação de senha).
    const espera = controleLogin.segundosRestantes(login);
    if (espera > 0) {
      throw new MuitasTentativas(`Muitas tentativas de login. Tente novamente em ${Math.ceil(espera / 60)} minuto(s).`);
    }

    const u = await this.usuarios.buscarPorLogin(login);
    const ok = await verificarSenha(senha, u?.senhaHash ?? HASH_FICTICIO);

    if (!u || !ok || !u.ativo) {
      controleLogin.registrarFalha(login);
      throw new NaoAutenticado('Usuário ou senha inválidos.');
    }
    controleLogin.registrarSucesso(login);

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: u.id }, data: { ultimoAcesso: new Date() } });
      await registrarJournal(tx, { operacao: 'LOGIN', entidade: 'Usuario', entidadeId: u.id, usuario: u.usuario });
    });

    return { id: u.id, usuario: u.usuario, papel: u.papel };
  }

  async alterarSenha(usuarioId: string, senhaAtual: string, novaSenha: string): Promise<void> {
    validarForcaSenha(novaSenha);
    const u = await this.usuarios.buscarPorId(usuarioId);
    if (!u || !(await verificarSenha(senhaAtual, u.senhaHash))) {
      throw new NaoAutenticado('Senha atual incorreta.');
    }
    const senhaHash = await gerarHashSenha(novaSenha);
    await prisma.$transaction(async (tx) => {
      await this.usuarios.atualizar(u.id, { senhaHash }, tx);
      await registrarJournal(tx, { operacao: 'ATUALIZAR', entidade: 'Usuario', entidadeId: u.id, usuario: u.usuario, dadosDepois: { campo: 'senha' } });
    });
  }
}

// Oliver passou por aqui.
