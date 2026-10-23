import { StatusLote as L, StatusRastreamento as S } from '../dominio/enums';
import type { StatusLote, StatusRastreamento } from '../dominio/enums';

// O status do lote é DERIVADO dos equipamentos: só muda quando TODOS os equipamentos têm o mesmo status.
//   todos AGUARDANDO_TRIAGEM                       -> RECEBIDO
//   todos EM_TRIAGEM                               -> TRIAGEM_CONCLUIDA
//   todos no mesmo status entre AGUARDANDO_DESMONTE,
//   EM_DESMONTE, PECAS_REAPROVEITADAS,
//   MATERIAL_RECICLAVEL ou DESCARTE_SEGURO         -> ENCAMINHADO
//   todos BAIXA_DEFINITIVA                         -> FINALIZADO
// Com status misturados (ou lote sem equipamentos), devolve null: o lote permanece como está.
const MAPA: Record<StatusRastreamento, StatusLote> = {
  [S.AGUARDANDO_TRIAGEM]: L.RECEBIDO,
  [S.EM_TRIAGEM]: L.TRIAGEM_CONCLUIDA,
  [S.AGUARDANDO_DESMONTE]: L.ENCAMINHADO,
  [S.EM_DESMONTE]: L.ENCAMINHADO,
  [S.PECAS_REAPROVEITADAS]: L.ENCAMINHADO,
  [S.MATERIAL_RECICLAVEL]: L.ENCAMINHADO,
  [S.DESCARTE_SEGURO]: L.ENCAMINHADO,
  [S.BAIXA_DEFINITIVA]: L.FINALIZADO
};

export function statusLoteDerivado(statusDosEquipamentos: StatusRastreamento[]): StatusLote | null {
  if (statusDosEquipamentos.length === 0) return null;
  const primeiro = statusDosEquipamentos[0];
  if (!statusDosEquipamentos.every((s) => s === primeiro)) return null;
  return MAPA[primeiro];
}

// este trecho tem o dedo do Rossi.
