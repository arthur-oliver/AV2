// Recuperação de emergência do SUPERUSUARIO (esqueceu a senha ou a conta foi bloqueada/desativada).
// Quem roda este script precisa ter acesso ao servidor e ao arquivo .env (ou seja, ao banco): é o "cofre" do sistema.
//
// Uso:   npm run superusuario:redefinir -- NovaSenha@123
//
// O script define a senha, reativa a conta e registra a operação no journal. Se o superusuário ainda não
// existir (banco sem seed), cria o login "superusuario". O papel SUPERUSUARIO continua único.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senha = process.argv[2] ?? '';
  if (senha.length < 8 || senha.length > 72 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    console.error('Informe a nova senha (8 a 72 caracteres, com letra e número):');
    console.error('  npm run superusuario:redefinir -- NovaSenha@123');
    process.exit(1);
  }
  const senhaHash = await bcrypt.hash(senha, 10);

  await prisma.$transaction(async (tx) => {
    const existente = await tx.usuario.findFirst({ where: { papel: 'SUPERUSUARIO' } });
    const u = existente
      ? await tx.usuario.update({ where: { id: existente.id }, data: { senhaHash, ativo: true, versao: { increment: 1 } } })
      : await tx.usuario.create({ data: { usuario: 'superusuario', nome: 'Superusuário', senhaHash, papel: 'SUPERUSUARIO' } });

    await tx.journalTransacao.create({
      data: {
        operacao: existente ? 'ATUALIZAR' : 'CRIAR',
        entidade: 'Usuario',
        entidadeId: u.id,
        dadosDepois: { campo: 'senha', origem: 'script superusuario:redefinir' },
        usuarioResponsavel: 'script-local'
      }
    });
    console.log(`Senha do superusuário "${u.usuario}" redefinida e conta ativada.`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// escrito com carinho por Arthur.
