import { describe, expect, it } from 'vitest';
import { statusLoteDerivado } from '../../src/regras/statusLote';

describe('status do lote derivado dos equipamentos', () => {
  it('só muda quando todos os equipamentos têm o mesmo status', () => {
    expect(statusLoteDerivado(['AGUARDANDO_TRIAGEM', 'AGUARDANDO_TRIAGEM'])).toBe('RECEBIDO');
    expect(statusLoteDerivado(['EM_TRIAGEM', 'EM_TRIAGEM'])).toBe('TRIAGEM_CONCLUIDA');
    expect(statusLoteDerivado(['AGUARDANDO_DESMONTE', 'AGUARDANDO_DESMONTE'])).toBe('ENCAMINHADO');
    expect(statusLoteDerivado(['DESCARTE_SEGURO'])).toBe('ENCAMINHADO');
    expect(statusLoteDerivado(['BAIXA_DEFINITIVA', 'BAIXA_DEFINITIVA', 'BAIXA_DEFINITIVA'])).toBe('FINALIZADO');
  });

  it('com status misturados, o lote não muda (devolve null)', () => {
    expect(statusLoteDerivado(['EM_TRIAGEM', 'AGUARDANDO_DESMONTE'])).toBeNull();
    expect(statusLoteDerivado(['BAIXA_DEFINITIVA', 'DESCARTE_SEGURO'])).toBeNull();
  });

  it('lote sem equipamentos não muda', () => {
    expect(statusLoteDerivado([])).toBeNull();
  });
});
