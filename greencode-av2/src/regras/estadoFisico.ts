import { EstadoFisico } from '../dominio/enums';
import { RegraNegocio } from '../erros/AppError';

const ORDEM = Object.values(EstadoFisico);

// Quantas categorias o estado piorou (positivo = piorou, negativo = melhorou).
export function categoriasPioradas(anterior: EstadoFisico, novo: EstadoFisico): number {
  return ORDEM.indexOf(novo) - ORDEM.indexOf(anterior);
}

// Regra da AV1: queda de 2 ou mais categorias exige justificativa textual.
export function validarMudancaEstadoFisico(
  anterior: EstadoFisico,
  novo: EstadoFisico,
  justificativa?: string
): void {
  if (categoriasPioradas(anterior, novo) >= 2 && !justificativa?.trim()) {
    throw new RegraNegocio(
      'Justificativa obrigatória quando o estado físico piora duas ou mais categorias.'
    );
  }
}

// escrito com carinho por Arthur.
