import { describe, expect, it } from "vitest";
import { gcd, parseOperation } from "./fractions";
import { equationResult, solveLinearEquation } from "./equations";
import { analyzeCollection, numberLineTicks } from "./numbers";

describe("Exactitud matemática acotada", () => {
  it("conserva el valor racional y simplifica sumas y restas admitidas", () => {
    let checked = 0;
    for (let ad = 1; ad <= 12; ad++) {
      for (let bd = 1; bd <= 12; bd++) {
        if (ad / gcd(ad, bd) * bd > 60) continue;
        for (let an = 0; an <= Math.min(6, ad * 3); an++) {
          for (let bn = 0; bn <= Math.min(6, bd * 3); bn++) {
            for (const sign of [1, -1]) {
              const numerator = an * bd + sign * bn * ad;
              if (numerator < 0) continue;
              const result = parseOperation(
                `${an}/${ad} ${sign === 1 ? "+" : "-"} ${bn}/${bd}`,
              ).simplified;
              expect(result.n * ad * bd).toBe(numerator * result.d);
              expect(gcd(result.n, result.d)).toBe(1);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });
  it("resuelve ecuaciones por aritmética racional y verifica sustitución exacta", () => {
    for (let a = -4; a <= 4; a++) {
      for (let b = -4; b <= 4; b++) {
        for (let c = -4; c <= 4; c++) {
          for (let d = -4; d <= 4; d++) {
            const result = solveLinearEquation({ a, b, c, d });
            if (result.kind === "unique") {
              expect(a).not.toBe(c);
              expect(a * result.n + b * result.d).toBe(
                c * result.n + d * result.d,
              );
              expect(result.d).toBeGreaterThan(0);
              expect(gcd(result.n, result.d)).toBe(1);
            } else {
              expect(a).toBe(c);
              expect(result.kind).toBe(b === d ? "all" : "none");
            }
          }
        }
      }
    }
  });
  it("clasifica ecuaciones degeneradas sin dividir por cero", () => {
    expect(equationResult(solveLinearEquation({ a: 0, b: 1, c: 0, d: 2 })))
      .toBe("Sin solución");
    expect(equationResult(solveLinearEquation({ a: 2, b: 3, c: 2, d: 3 })))
      .toBe("Infinitas soluciones en ℝ");
    expect(equationResult(solveLinearEquation({ a: -2, b: 1, c: 0, d: 4 })))
      .toBe("-3/2");
    expect(() => solveLinearEquation({ a: 1001, b: 0, c: 0, d: 0 })).toThrow();
    expect(() => solveLinearEquation({ a: Infinity, b: 0, c: 0, d: 0 }))
      .toThrow();
  });
  it("calcula estadísticas con media racional y conserva multiplicidades", () => {
    expect(analyzeCollection([-2, -2, 2])).toEqual({
      count: 3,
      sum: -2,
      minimum: -2,
      maximum: 2,
      mean: { n: -2, d: 3 },
    });
    expect(analyzeCollection(Array<number>(24).fill(1000)).sum).toBe(24000);
    for (
      const invalid of [[], [NaN], [1.5], [1001], Array<number>(25).fill(1)]
    ) expect(() => analyzeCollection(invalid)).toThrow();
  });
  it("genera marcas exactas y limita densidad, dominio y paso", () => {
    expect(numberLineTicks(-6, 6, 3)).toEqual([-6, -3, 0, 3, 6]);
    for (
      const [min, max, step] of [
        [0, 0, 1],
        [-100, 100, 1],
        [-5, 5, 3],
        [-5, 5, 0],
        [0, 5, .5],
        [-101, 0, 2],
      ]
    ) expect(() => numberLineTicks(min!, max!, step!)).toThrow();
  });
});
