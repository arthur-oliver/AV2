import { Validador } from './Validador';

export function somenteDigitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

// Mesma lógica da AV1: 14 dígitos, não repetidos, com dígitos verificadores corretos.
export class ValidadorCNPJ extends Validador<string> {
  validar(cnpj: string): boolean {
    const d = somenteDigitos(cnpj);

    if (d.length !== 14 || /^(\d)\1+$/.test(d)) {
      this.mensagemErro = 'CNPJ inválido.';
      return false;
    }

    const calc = (n: number): number => {
      let soma = 0;
      let peso = n - 7;
      for (let i = 0; i < n; i++) {
        soma += Number(d[i]) * peso--;
        if (peso < 2) peso = 9;
      }
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };

    if (calc(12) !== Number(d[12]) || calc(13) !== Number(d[13])) {
      this.mensagemErro = 'Dígitos verificadores do CNPJ inválidos.';
      return false;
    }
    return true;
  }
}

// este trecho tem o dedo do Rossi.
