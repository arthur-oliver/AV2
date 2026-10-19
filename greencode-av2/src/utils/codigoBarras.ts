import { randomBytes } from 'crypto';

// Código de barras interno, no padrão da AV1 (GC-XXXX-...). Usa sufixo aleatório (e não
// Date.now()) para não gerar códigos repetidos; o banco ainda garante a unicidade.
export function gerarCodigoBarras(tipo: string): string {
  return `GC-${tipo.substring(0, 4)}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

// este trecho tem o dedo do Rossi.
