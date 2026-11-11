import { describe, expect, it } from 'vitest';
import { parseOperation } from './fractions';
describe('Operaciones del lienzo', () => {
  it('homogeneiza conservando cantidades y simplifica un resultado impropio', () => {
    expect(parseOperation('2/3 + 3/6')).toMatchObject({ denominator: 6, left: 4, right: 3, total: 7, simplified: { n: 7, d: 6 } });
  });
  it('resta con el mínimo común múltiplo y admite el signo tipográfico', () => {
    expect(parseOperation('3/4 − 1/6')).toMatchObject({ denominator: 12, total: 7 });
  });
  it('simplifica resultados reducibles y cero', () => {
    expect(parseOperation('1/2 + 1/2').simplified).toEqual({ n: 1, d: 1 });
    expect(parseOperation('2/3 - 2/3').simplified).toEqual({ n: 0, d: 1 });
  });
  it.each(['1/0 + 1/2', 'hola', '2/3 * 1/2', '1/2 - 3/4', '1/23 + 1/24'])('rechaza entradas no representables: %s', input => { expect(() => parseOperation(input)).toThrow(); });
  it('mantiene la equivalencia y la suma en todos los denominadores admitidos', () => {
    for (let a = 1; a <= 24; a++) for (let b = 1; b <= 24; b++) {
      const common = a * b;
      if (common > 60 && a !== b && common % Math.min(a, b)) continue;
      let result; try { result = parseOperation(`1/${a} + 1/${b}`); } catch { continue; }
      expect(result.left * a).toBe(result.denominator);
      expect(result.right * b).toBe(result.denominator);
      expect(result.total).toBe(result.left + result.right);
      expect(result.simplified.n * result.denominator).toBe(result.total * result.simplified.d);
    }
  });
});
