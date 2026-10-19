import { StatusLote, StatusRastreamento as S } from '../dominio/enums';
import type { StatusRastreamento } from '../dominio/enums';
import { RegraNegocio } from '../erros/AppError';

// Transições permitidas do status de rastreamento de um equipamento.
const TRANSICOES: Record<StatusRastreamento, StatusRastreamento[]> = {
  [S.AGUARDANDO_TRIAGEM]: [S.EM_TRIAGEM],
  [S.EM_TRIAGEM]: [S.AGUARDANDO_DESMONTE, S.MATERIAL_RECICLAVEL, S.DESCARTE_SEGURO],
  [S.AGUARDANDO_DESMONTE]: [S.EM_DESMONTE],
  [S.EM_DESMONTE]: [S.PECAS_REAPROVEITADAS, S.MATERIAL_RECICLAVEL, S.DESCARTE_SEGURO],
  [S.PECAS_REAPROVEITADAS]: [S.BAIXA_DEFINITIVA],
  [S.MATERIAL_RECICLAVEL]: [S.BAIXA_DEFINITIVA],
  [S.DESCARTE_SEGURO]: [S.BAIXA_DEFINITIVA],
  [S.BAIXA_DEFINITIVA]: []
};

const STATUS_DE_DESMONTE: StatusRastreamento[] = [S.AGUARDANDO_DESMONTE, S.EM_DESMONTE];

const LOTE_COM_TRIAGEM_COMPLETA: string[] = [
  StatusLote.TRIAGEM_CONCLUIDA,
  StatusLote.ENCAMINHADO,
  StatusLote.FINALIZADO
];

export function validarTransicaoRastreamento(
  atual: StatusRastreamento,
  novo: StatusRastreamento,
  statusLote: string,
  justificativa?: string
): void {
  if (atual === novo) {
    throw new RegraNegocio('O equipamento já está neste status.');
  }
  if (!TRANSICOES[atual].includes(novo)) {
    throw new RegraNegocio(`Transição inválida: ${atual} -> ${novo}.`);
  }
  // Regra da AV1: só vai para desmonte depois da triagem COMPLETA (do lote).
  if (STATUS_DE_DESMONTE.includes(novo) && !LOTE_COM_TRIAGEM_COMPLETA.includes(statusLote)) {
    throw new RegraNegocio('O equipamento só pode ir para desmonte após a triagem completa do lote.');
  }
  // Regra do domínio da AV1: toda alteração de status exige justificativa.
  if (!justificativa?.trim()) {
    throw new RegraNegocio('Justificativa obrigatória para alteração de status.');
  }
}

export function transicoesPermitidas(atual: StatusRastreamento): StatusRastreamento[] {
  return TRANSICOES[atual];
}

// este trecho tem o dedo do Rossi.
