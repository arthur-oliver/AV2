import { describe, expect, it } from 'vitest';
import { ControleTentativasLogin } from '../../src/seguranca/tentativasLogin';

// Relógio falso: permite "passar o tempo" sem esperar.
function criar(max = 5, bloqueioMs = 15 * 60 * 1000, limite = 10000) {
  let agora = 1_000_000;
  const controle = new ControleTentativasLogin(max, bloqueioMs, () => agora, limite);
  return { controle, avancar: (ms: number) => (agora += ms) };
}

describe('bloqueio de login por tentativas', () => {
  it('não bloqueia antes de atingir o limite', () => {
    const { controle } = criar();
    for (let i = 0; i < 4; i++) controle.registrarFalha('ana');
    expect(controle.segundosRestantes('ana')).toBe(0);
  });

  it('bloqueia na 5ª falha seguida', () => {
    const { controle } = criar();
    for (let i = 0; i < 5; i++) controle.registrarFalha('ana');
    expect(controle.segundosRestantes('ana')).toBe(15 * 60);
  });

  it('o tempo restante diminui e o bloqueio termina sozinho', () => {
    const { controle, avancar } = criar();
    for (let i = 0; i < 5; i++) controle.registrarFalha('ana');
    avancar(5 * 60 * 1000);
    expect(controle.segundosRestantes('ana')).toBe(10 * 60);
    avancar(10 * 60 * 1000);
    expect(controle.segundosRestantes('ana')).toBe(0);
  });

  it('depois que o bloqueio expira, a contagem recomeça do zero', () => {
    const { controle, avancar } = criar();
    for (let i = 0; i < 5; i++) controle.registrarFalha('ana');
    avancar(15 * 60 * 1000 + 1);
    controle.registrarFalha('ana');
    expect(controle.segundosRestantes('ana')).toBe(0);
  });

  it('um login correto zera as falhas', () => {
    const { controle } = criar();
    for (let i = 0; i < 4; i++) controle.registrarFalha('ana');
    controle.registrarSucesso('ana');
    controle.registrarFalha('ana');
    expect(controle.segundosRestantes('ana')).toBe(0);
  });

  it('falhas antigas (fora da janela) não se acumulam', () => {
    const { controle, avancar } = criar();
    for (let i = 0; i < 4; i++) controle.registrarFalha('ana');
    avancar(16 * 60 * 1000);
    controle.registrarFalha('ana');
    expect(controle.segundosRestantes('ana')).toBe(0);
  });

  it('cada login tem a sua contagem, sem diferenciar maiúsculas de minúsculas', () => {
    const { controle } = criar();
    for (let i = 0; i < 5; i++) controle.registrarFalha('Ana');
    expect(controle.segundosRestantes('ana')).toBeGreaterThan(0);
    expect(controle.segundosRestantes('bruno')).toBe(0);
  });

  it('limpar() libera todo mundo', () => {
    const { controle } = criar();
    for (let i = 0; i < 5; i++) controle.registrarFalha('ana');
    controle.limpar();
    expect(controle.segundosRestantes('ana')).toBe(0);
  });

  it('não cresce sem limite quando surgem muitos logins diferentes', () => {
    const { controle } = criar(5, 15 * 60 * 1000, 50);
    for (let i = 0; i < 500; i++) controle.registrarFalha(`login${i}`);
    // os mais antigos foram descartados (sem bloqueio); os mais recentes continuam contados
    for (let i = 0; i < 4; i++) controle.registrarFalha('login499');
    expect(controle.segundosRestantes('login499')).toBeGreaterThan(0);
  });
});

// Arthur Oliver Rossi Alves, autor do Greencode.
