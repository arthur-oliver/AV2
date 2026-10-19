import { describe, expect, it } from 'vitest';
import {
  PAPEIS_ESSENCIAIS,
  exigirContinuidadeDoPapel,
  exigirNaoSuperusuario,
  exigirPapelAtribuivel,
  papelEhEssencial,
  validarNome
} from '../../src/regras/usuarios';
import { RegraNegocio } from '../../src/erros/AppError';

describe('regra: sempre ao menos 1 usuário ativo nos papéis essenciais', () => {
  it('administrador, operador de cadastro e gestor são essenciais; auditor não', () => {
    expect(PAPEIS_ESSENCIAIS).toEqual(['ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO']);
    expect(papelEhEssencial('ADMINISTRADOR')).toBe(true);
    expect(papelEhEssencial('OPERADOR_CADASTRO')).toBe(true);
    expect(papelEhEssencial('GESTOR_ALMOXARIFADO')).toBe(true);
    expect(papelEhEssencial('AUDITOR')).toBe(false);
  });

  it('recusa quando o alvo é o único ativo do papel', () => {
    expect(() => exigirContinuidadeDoPapel('ADMINISTRADOR', ['a1'], 'a1', 'desativar este usuário')).toThrow(RegraNegocio);
    expect(() => exigirContinuidadeDoPapel('OPERADOR_CADASTRO', ['o1'], 'o1', 'excluir este usuário')).toThrow(/nenhum usuário ativo/);
    expect(() => exigirContinuidadeDoPapel('GESTOR_ALMOXARIFADO', ['g1'], 'g1', 'trocar o papel deste usuário')).toThrow(RegraNegocio);
  });

  it('permite quando sobra pelo menos outro usuário ativo', () => {
    expect(() => exigirContinuidadeDoPapel('ADMINISTRADOR', ['a1', 'a2'], 'a1', 'desativar este usuário')).not.toThrow();
    expect(() => exigirContinuidadeDoPapel('GESTOR_ALMOXARIFADO', ['g1', 'g2', 'g3'], 'g2', 'excluir este usuário')).not.toThrow();
  });

  it('o auditor pode ficar sem ninguém ativo', () => {
    expect(() => exigirContinuidadeDoPapel('AUDITOR', ['u1'], 'u1', 'desativar este usuário')).not.toThrow();
  });

  it('a mensagem diz qual ação foi recusada e qual papel ficaria vazio', () => {
    try {
      exigirContinuidadeDoPapel('ADMINISTRADOR', ['a1'], 'a1', 'desativar este usuário');
      expect.unreachable('deveria ter lançado erro');
    } catch (e) {
      expect((e as Error).message).toContain('desativar este usuário');
      expect((e as Error).message).toContain('ADMINISTRADOR');
    }
  });
});

describe('regras do superusuário (único e protegido)', () => {
  it('o papel SUPERUSUARIO não é atribuível a outros usuários', () => {
    expect(() => exigirPapelAtribuivel('SUPERUSUARIO')).toThrow(RegraNegocio);
    for (const p of ['ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR'] as const) {
      expect(() => exigirPapelAtribuivel(p)).not.toThrow();
    }
  });

  it('o superusuário não pode ser rebaixado, desativado nem excluído', () => {
    expect(() => exigirNaoSuperusuario('SUPERUSUARIO', 'excluir este usuário')).toThrow(/único e protegido/);
    expect(() => exigirNaoSuperusuario('ADMINISTRADOR', 'excluir este usuário')).not.toThrow();
  });

  it('o superusuário não entra na regra de papéis essenciais (é protegido à parte)', () => {
    expect(papelEhEssencial('SUPERUSUARIO')).toBe(false);
  });

  it('valida o nome: apara e junta espaços, de 2 a 120 caracteres', () => {
    expect(validarNome('  Maria   da  Silva ')).toBe('Maria da Silva');
    expect(() => validarNome(' a ')).toThrow(RegraNegocio);
    expect(() => validarNome('x'.repeat(121))).toThrow(RegraNegocio);
    expect(validarNome('x'.repeat(120))).toHaveLength(120);
  });
});

// escrito com carinho por Arthur.
