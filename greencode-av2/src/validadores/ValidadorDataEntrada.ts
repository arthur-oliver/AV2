import { Validador } from './Validador';

const NOVENTA_DIAS_MS = 90 * 24 * 60 * 60 * 1000;

// Regra da AV1: a data de entrada do lote não pode ser futura nem anterior a 90 dias.
export class ValidadorDataEntrada extends Validador<Date> {
  constructor(private readonly agora: () => number = Date.now) {
    super();
  }

  validar(data: Date): boolean {
    const t = data.getTime();
    const agora = this.agora();

    if (Number.isNaN(t) || t > agora || t < agora - NOVENTA_DIAS_MS) {
      this.mensagemErro = 'A data de entrada deve estar entre hoje e os últimos 90 dias.';
      return false;
    }
    return true;
  }
}

// Oliver passou por aqui.
