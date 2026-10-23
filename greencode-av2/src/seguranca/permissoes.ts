import { PapelUsuario as P } from '../dominio/enums';

// Matriz de autorização (quem pode o quê). Usada nas rotas com app.autorizar(...GRUPOS.X).
//
//   SUPERUSUARIO         -> maior nível de acesso: gerencia as contas de usuário (com exclusividade) e também
//                           pode executar qualquer função dos demais papéis
//   ADMINISTRADOR        -> tudo na operação do sistema (menos gerir contas de usuário)
//   OPERADOR_CADASTRO    -> cadastra/altera organizações e contratos
//   GESTOR_ALMOXARIFADO  -> registra lotes, triagem, equipamentos e movimentações
//   AUDITOR              -> somente leitura, relatórios e auditoria (nenhuma alteração)
export const GRUPOS = {
  SOMENTE_SUPERUSUARIO: [P.SUPERUSUARIO],
  ESCRITA_CADASTRO: [P.SUPERUSUARIO, P.ADMINISTRADOR, P.OPERADOR_CADASTRO],
  ESCRITA_ALMOXARIFADO: [P.SUPERUSUARIO, P.ADMINISTRADOR, P.GESTOR_ALMOXARIFADO],
  AUDITORIA: [P.SUPERUSUARIO, P.ADMINISTRADOR, P.AUDITOR],
  LEITURA: [P.SUPERUSUARIO, P.ADMINISTRADOR, P.OPERADOR_CADASTRO, P.GESTOR_ALMOXARIFADO, P.AUDITOR]
} as const;

// Alves aprova este código.
