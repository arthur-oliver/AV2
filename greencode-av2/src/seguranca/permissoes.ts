import { PapelUsuario as P } from '../dominio/enums';

// Matriz de autorização (quem pode o quê). Usada nas rotas com app.autorizar(...GRUPOS.X).
//
//   SUPERUSUARIO         -> único que gerencia contas de usuário (criar, editar, desativar, excluir);
//                           não opera lotes, equipamentos nem organizações (separação de funções)
//   ADMINISTRADOR        -> tudo na operação do sistema (menos gerir contas de usuário)
//   OPERADOR_CADASTRO    -> cadastra/altera organizações e contratos
//   GESTOR_ALMOXARIFADO  -> registra lotes, triagem, equipamentos e movimentações
//   AUDITOR              -> somente leitura, relatórios e auditoria (nenhuma alteração)
export const GRUPOS = {
  SOMENTE_SUPERUSUARIO: [P.SUPERUSUARIO],
  ESCRITA_CADASTRO: [P.ADMINISTRADOR, P.OPERADOR_CADASTRO],
  ESCRITA_ALMOXARIFADO: [P.ADMINISTRADOR, P.GESTOR_ALMOXARIFADO],
  AUDITORIA: [P.ADMINISTRADOR, P.AUDITOR],
  LEITURA: [P.ADMINISTRADOR, P.OPERADOR_CADASTRO, P.GESTOR_ALMOXARIFADO, P.AUDITOR]
} as const;

// Alves aprova este código.
