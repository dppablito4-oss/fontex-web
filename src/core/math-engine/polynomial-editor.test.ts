import { expect, it } from "vitest";
import { compileFunctionGraph } from "./function-graphs";
import { polynomialCoefficients, polynomialSolutions, polynomialSource } from "./polynomial-editor";
import { superscriptPowers } from "./math-notation";
import { evaluate, parseExpression } from "../scene/expression";
const variables = { a: 1, b: -3, c: 2 };

it("edits coefficients of a quadratic, cubic and degree eight without adding new object templates", () => {
  expect(polynomialCoefficients("a*x²+b*x+c", variables)).toEqual([2, -3, 1]);
  for (const values of [[1, -3, 2], [1, -3, 2, 0], [0, 1, 0, 2], [1, 0, 0, 0, 0, 0, 0, 0, -1]]) {
    const source = polynomialSource(values, true);
    expect(polynomialCoefficients(source, variables)).toEqual([...values].reverse());
    expect(evaluate(parseExpression(source), 2, variables)).toBeCloseTo(values.reduce((total, n) => total * 2 + n, 0));
  }
  expect(polynomialCoefficients("sin(x)", variables)).toBeNull();
  expect(polynomialCoefficients("x^9", variables)).toBeNull();
  expect(polynomialCoefficients("1/x", variables)).toBeNull();
});

it("distinguishes real roots, contradictions, identities and degrees beyond the numeric solver", () => {
  const quadratic = polynomialSolutions([2, -3, 1]);
  expect(quadratic.kind).toBe("roots"); expect(quadratic.roots).toHaveLength(2);
  quadratic.roots.forEach((x, i) => expect(x).toBeCloseTo([1, 2][i]!, 10));
  polynomialSolutions([0, -1, 0, 1]).roots.forEach((x, i) => expect(x).toBeCloseTo([-1, 0, 1][i]!, 10));
  expect(polynomialSolutions([1, 0, 1]).kind).toBe("none");
  expect(polynomialSolutions([0, 0, 0]).kind).toBe("all");
  expect(polynomialSolutions([2, 0, 0]).kind).toBe("none");
  expect(polynomialSolutions([-1, 0, 0, 0, 0, 1]).kind).toBe("unsupported");
});

it("accepts displayed superscripts while preserving exponent precedence and scientific numbers", () => {
  for (const [source, value] of [["x²", 9], ["-x²", -9], ["x⁻²", 1 / 9], ["x¹²", 3 ** 12], ["(x+1)³", 64]] as const) expect(evaluate(parseExpression(source), 3, variables)).toBeCloseTo(value);
  expect(superscriptPowers("x^2 + x^(12) + x^-3")).toBe("x² + x¹² + x⁻³");
  expect(superscriptPowers("x^2.5 + x^2e3")).toBe("x^2.5 + x^2e3");
  const graph = compileFunctionGraph({ ...variables, source: "x³-x", angleUnit: "radians", xMin: -2, xMax: 2, yMin: -8, yMax: 8, pointXs: [], showDerivative: true });
  expect(graph.valueAt(2)).toBe(6); expect(graph.slopeAt(2)).toBe(11);
});
