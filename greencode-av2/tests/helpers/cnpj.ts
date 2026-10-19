// Gera um CNPJ válido (com dígitos verificadores corretos) e único a cada chamada.
export function gerarCnpjValido(): string {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('') + '0001';
  const dv = (s: string, pesoInicial: number) => {
    let soma = 0;
    let peso = pesoInicial;
    for (const ch of s) {
      soma += Number(ch) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, 5);
  const d2 = dv(base + d1, 6);
  return base + d1 + d2;
}

// Arthur Oliver Rossi Alves, autor do Greencode.
