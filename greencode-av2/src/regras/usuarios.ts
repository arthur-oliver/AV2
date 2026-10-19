import { PapelUsuario as P } from '../dominio/enums';
import type { PapelUsuario } from '../dominio/enums';
import { RegraNegocio } from '../erros/AppError';

// Papéis sem os quais o sistema para de funcionar: sempre precisa existir pelo menos 1 usuário ATIVO em cada um.
//   ADMINISTRADOR        -> sem ele ninguém tem acesso total à operação
//   OPERADOR_CADASTRO    -> sem ele ninguém cadastra organizações e contratos
//   GESTOR_ALMOXARIFADO  -> sem ele ninguém recebe lotes nem faz triagem
// O AUDITOR só consulta, então o sistema continua operando sem ele (por isso não é essencial).
export const PAPEIS_ESSENCIAIS: readonly PapelUsuario[] = [P.ADMINISTRADOR, P.OPERADOR_CADASTRO, P.GESTOR_ALMOXARIFADO];

export function papelEhEssencial(papel: PapelUsuario): boolean {
  return PAPEIS_ESSENCIAIS.includes(papel);
}

// Regra de continuidade: depois da operação (desativar, excluir ou trocar o papel do usuário alvo),
// ainda precisa sobrar alguém ativo no papel essencial.
//   idsAtivosDoPapel: ids de TODOS os usuários ativos que hoje têm o papel (inclui o alvo, se ele estiver ativo)
//   idAlvo:           usuário que deixaria de ocupar o papel
export function exigirContinuidadeDoPapel(
  papel: PapelUsuario,
  idsAtivosDoPapel: readonly string[],
  idAlvo: string,
  acao: string
): void {
  if (!papelEhEssencial(papel)) return;
  const restantes = idsAtivosDoPapel.filter((id) => id !== idAlvo).length;
  if (restantes === 0) {
    throw new RegraNegocio(
      `Não é possível ${acao}: o sistema ficaria sem nenhum usuário ativo com o papel ${papel}. Cadastre ou ative outro usuário com este papel antes.`
    );
  }
}

// O SUPERUSUARIO é único, nasce no seed (ou pelo script de redefinição) e nunca é criado, atribuído,
// rebaixado, desativado nem excluído pela API: assim o sistema nunca fica sem quem gerencie as contas.
export function exigirPapelAtribuivel(papel: PapelUsuario): void {
  if (papel === P.SUPERUSUARIO) {
    throw new RegraNegocio('O papel SUPERUSUARIO é único e reservado: não pode ser atribuído a outros usuários.');
  }
}

export function exigirNaoSuperusuario(papel: PapelUsuario, acao: string): void {
  if (papel === P.SUPERUSUARIO) {
    throw new RegraNegocio(`Não é possível ${acao}: o superusuário é único e protegido.`);
  }
}

// Nome de exibição: texto livre, sem espaços nas pontas, de 2 a 120 caracteres.
export function validarNome(nome: string): string {
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (limpo.length < 2 || limpo.length > 120) {
    throw new RegraNegocio('O nome deve ter de 2 a 120 caracteres.');
  }
  return limpo;
}

// Oliver passou por aqui.
