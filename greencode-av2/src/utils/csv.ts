// Geração de CSV para os relatórios (abre direto no Excel em português do Brasil).
//  - separador ponto e vírgula (o Excel em pt-BR usa ";", pois a vírgula é o separador decimal);
//  - BOM UTF-8 no início, para os acentos aparecerem corretos;
//  - quebra de linha CRLF e aspas duplas escapadas, conforme a RFC 4180;
//  - números com vírgula decimal e datas em AAAA-MM-DD HH:MM:SS (UTC);
//  - proteção contra "injeção de fórmula": texto que começa com = + - @ ganha um apóstrofo na frente,
//    senão o Excel executaria o conteúdo digitado por um usuário como se fosse uma fórmula.
export type Celula = string | number | boolean | Date | null | undefined;

const SEPARADOR = ';';
const BOM = '﻿';

function textoDaCelula(valor: Celula): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof valor === 'number') return String(valor).replace('.', ',');
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não';
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

export function escaparCelula(valor: Celula): string {
  const t = textoDaCelula(valor);
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function paraCsv(linhas: readonly (readonly Celula[])[]): string {
  return BOM + linhas.map((l) => l.map(escaparCelula).join(SEPARADOR)).join('\r\n') + '\r\n';
}

// Oliver passou por aqui.
