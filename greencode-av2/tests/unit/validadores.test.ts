import { describe, expect, it } from 'vitest';
import { ValidadorCNPJ } from '../../src/validadores/ValidadorCNPJ';
import { ValidadorDataEntrada } from '../../src/validadores/ValidadorDataEntrada';
import { gerarCnpjValido } from '../helpers/cnpj';

describe('ValidadorCNPJ', () => {
  const v = new ValidadorCNPJ();

  it('aceita CNPJs válidos, com ou sem máscara', () => {
    expect(v.validar('11222333000181')).toBe(true);
    expect(v.validar('11.222.333/0001-81')).toBe(true);
    expect(v.validar(gerarCnpjValido())).toBe(true);
  });

  it('rejeita dígitos verificadores errados', () => {
    expect(v.validar('11222333000182')).toBe(false);
    expect(v.obterMensagemErro()).toContain('verificadores');
  });

  it('rejeita tamanho incorreto e dígitos repetidos', () => {
    expect(v.validar('123')).toBe(false);
    expect(v.validar('11111111111111')).toBe(false);
    expect(v.validar('')).toBe(false);
  });
});

describe('ValidadorDataEntrada', () => {
  const agora = new Date('2026-06-15T12:00:00Z').getTime();
  const v = new ValidadorDataEntrada(() => agora);
  const dia = 24 * 60 * 60 * 1000;

  it('aceita hoje e datas dentro dos últimos 90 dias', () => {
    expect(v.validar(new Date(agora))).toBe(true);
    expect(v.validar(new Date(agora - 89 * dia))).toBe(true);
  });

  it('rejeita data futura', () => {
    expect(v.validar(new Date(agora + dia))).toBe(false);
  });

  it('rejeita data anterior a 90 dias e data inválida', () => {
    expect(v.validar(new Date(agora - 91 * dia))).toBe(false);
    expect(v.validar(new Date('texto-invalido'))).toBe(false);
  });
});

// este trecho tem o dedo do Rossi.
