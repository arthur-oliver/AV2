import { describe, expect, it } from 'vitest';
import { categoriasPioradas, validarMudancaEstadoFisico } from '../../src/regras/estadoFisico';
import { transicoesPermitidas, validarTransicaoRastreamento } from '../../src/regras/rastreamento';
import { RegraNegocio } from '../../src/erros/AppError';

describe('regra do estado físico', () => {
  it('conta quantas categorias o estado piorou', () => {
    expect(categoriasPioradas('NOVO', 'USADO_LEVE')).toBe(2);
    expect(categoriasPioradas('USADO_LEVE', 'NOVO')).toBe(-2);
  });

  it('piora de 1 categoria não exige justificativa', () => {
    expect(() => validarMudancaEstadoFisico('NOVO', 'BOM_ESTADO')).not.toThrow();
  });

  it('piora de 2 ou mais categorias exige justificativa', () => {
    expect(() => validarMudancaEstadoFisico('NOVO', 'USADO_LEVE')).toThrow(RegraNegocio);
    expect(() => validarMudancaEstadoFisico('NOVO', 'USADO_LEVE', '   ')).toThrow(RegraNegocio);
    expect(() => validarMudancaEstadoFisico('NOVO', 'USADO_LEVE', 'Caiu no transporte')).not.toThrow();
  });

  it('melhora de estado nunca exige justificativa', () => {
    expect(() => validarMudancaEstadoFisico('INSERVIVEL', 'NOVO')).not.toThrow();
  });
});

describe('regra de transição do rastreamento', () => {
  it('permite o caminho normal da triagem ao desmonte', () => {
    expect(() => validarTransicaoRastreamento('EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'TRIAGEM_CONCLUIDA', 'ok')).not.toThrow();
    expect(() => validarTransicaoRastreamento('AGUARDANDO_DESMONTE', 'EM_DESMONTE', 'TRIAGEM_CONCLUIDA', 'ok')).not.toThrow();
  });

  it('bloqueia desmonte enquanto a triagem do lote não terminou', () => {
    expect(() => validarTransicaoRastreamento('EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'EM_TRIAGEM', 'ok')).toThrow(/triagem completa/);
    expect(() => validarTransicaoRastreamento('EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'RECEBIDO', 'ok')).toThrow(/triagem completa/);
  });

  it('exige justificativa em qualquer mudança de status', () => {
    expect(() => validarTransicaoRastreamento('EM_TRIAGEM', 'DESCARTE_SEGURO', 'EM_TRIAGEM', '')).toThrow(/Justificativa/);
  });

  it('rejeita transições fora do fluxo e repetição do mesmo status', () => {
    expect(() => validarTransicaoRastreamento('AGUARDANDO_TRIAGEM', 'EM_DESMONTE', 'TRIAGEM_CONCLUIDA', 'x')).toThrow(/inválida/);
    expect(() => validarTransicaoRastreamento('EM_TRIAGEM', 'EM_TRIAGEM', 'EM_TRIAGEM', 'x')).toThrow(/já está/);
  });

  it('status final não tem próximas transições', () => {
    expect(transicoesPermitidas('BAIXA_DEFINITIVA')).toEqual([]);
  });
});

// Alves aprova este código.
