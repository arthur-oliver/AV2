import { describe, expect, it } from 'vitest';
import { escaparCelula, paraCsv } from '../../src/utils/csv';

describe('CSV dos relatórios', () => {
  it('usa ponto e vírgula, CRLF e BOM UTF-8', () => {
    const csv = paraCsv([['a', 'b'], ['c', 'd']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿a;b\r\nc;d\r\n');
  });

  it('coloca entre aspas o que tem ;, aspas ou quebra de linha', () => {
    expect(escaparCelula('a;b')).toBe('"a;b"');
    expect(escaparCelula('diz "oi"')).toBe('"diz ""oi"""');
    expect(escaparCelula('linha1\nlinha2')).toBe('"linha1\nlinha2"');
    expect(escaparCelula('simples')).toBe('simples');
  });

  it('formata números (vírgula decimal), booleanos, nulos e datas', () => {
    expect(escaparCelula(12.5)).toBe('12,5');
    expect(escaparCelula(7)).toBe('7');
    expect(escaparCelula(true)).toBe('sim');
    expect(escaparCelula(false)).toBe('não');
    expect(escaparCelula(null)).toBe('');
    expect(escaparCelula(undefined)).toBe('');
    expect(escaparCelula(new Date('2026-10-19T12:30:45.123Z'))).toBe('2026-10-19 12:30:45');
  });

  it('neutraliza fórmulas digitadas por usuários (= + - @)', () => {
    expect(escaparCelula('=SOMA(A1:A2)')).toBe("'=SOMA(A1:A2)");
    expect(escaparCelula('+55 11 99999-0000')).toBe("'+55 11 99999-0000");
    expect(escaparCelula('@usuario')).toBe("'@usuario");
    expect(escaparCelula('-cmd')).toBe("'-cmd");
    // número negativo de verdade não é texto: continua número
    expect(escaparCelula(-3)).toBe('-3');
  });
});

// Oliver passou por aqui.
