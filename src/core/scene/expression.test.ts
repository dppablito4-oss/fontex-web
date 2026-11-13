import { expect, it } from "vitest";
import {
  derivative,
  evaluate,
  parseExpression,
  polynomial,
  realRoots,
} from "./expression";
import { expressionScene, parseScene } from "./document";
const vars = { a: 2, b: 1, c: -3 };
it.each(
  [["-x^2", 2, -4], ["2x+3", 2, 7], ["2^3^2", 0, 512], ["sin(pi/2)", 0, 1], [
    "x^2=4",
    3,
    5,
  ], ["sqrt(x)", -1, NaN]] as const,
)("evaluates %s with mathematical precedence", (s, x, want) => {
  const n = evaluate(parseExpression(s), x, vars);
  if (Number.isNaN(want)) expect(n).toBeNaN();
  else expect(n).toBeCloseTo(want);
});
it.each([
  "x^3+2*x",
  "sin(2*x)",
  "cos(x)",
  "tan(x)",
  "ln(x)",
  "sqrt(x)",
  "exp(x)",
  "x^x",
  "a*x^2+b*x+c",
  "(x+1)/(x+2)",
])(
  "symbolic derivative agrees with an independent finite difference: %s",
  (s) => {
    const e = parseExpression(s), d = derivative(e), x = 1.2, h = 1e-5;
    expect(evaluate(d, x, vars)).toBeCloseTo(
      (evaluate(e, x + h, vars) - evaluate(e, x - h, vars)) / (2 * h),
      4,
    );
  },
);
it.each([
  ["x^2-5*x+6", [2, 3]],
  ["x^3-6*x^2+11*x-6", [1, 2, 3]],
  ["x^4-5*x^2+4", [-2, -1, 1, 2]],
  ["(x-1)^4", [1]],
  ["x^2+1", []],
])("finds real roots of %s including repeated roots", (s, want) => {
  const e = parseExpression(s), coeff = polynomial(e, vars)!;
  const roots = realRoots(coeff);
  expect(roots).toHaveLength(want.length);
  roots.forEach((r, i) => {
    expect(r).toBeCloseTo(want[i]!, 5);
    expect(Math.abs(evaluate(e, r, vars))).toBeLessThan(1e-6);
  });
});
it.each([
  "alert(1)",
  "x.constructor",
  "sin(x);fetch('x')",
  "<script>",
  "x=1=2",
  "sin(",
])(
  "rejects executable or invalid input %s",
  (s) => expect(() => parseExpression(s)).toThrow(),
);
it("links generic elements to valid expressions and rejects dangling references", () => {
  const scene = expressionScene("sin(x)");
  expect(parseScene(JSON.parse(JSON.stringify(scene)) as unknown)).toEqual(
    scene,
  );
  expect(() =>
    parseScene({
      ...scene,
      elements: [{ id: "bad", kind: "plot", expressionId: "missing" }],
    })
  ).toThrow();
});

it.each([1e-100, 1e-13, 1e-11, 1, 1e100])("keeps real roots invariant under nonzero scale %s", scale => {
  expect(realRoots(polynomial(parseExpression(`${scale}*(x^2+1)`), vars)!)).toEqual([]);
  const roots = realRoots(polynomial(parseExpression(`${scale}*(x^2-1)`), vars)!);
  expect(roots).toHaveLength(2);
  expect(roots[0]).toBeCloseTo(-1, 10);
  expect(roots[1]).toBeCloseTo(1, 10);
  expect(realRoots(polynomial(parseExpression(`${scale}*(x-1)^4`), vars)!)).toEqual([1]);
});

it("retains small leading coefficients and distinct nearby roots", () => {
  expect(realRoots(polynomial(parseExpression("1e-13*x-1"), vars)!)[0]).toBeCloseTo(1e13);
  expect(realRoots([1e-20, 0, 1])).toEqual([]);
  const roots = realRoots([-1e-16, 0, 1]);
  expect(roots).toHaveLength(2);
  expect(roots[0]).toBeCloseTo(-1e-8, 14);
  expect(roots[1]).toBeCloseTo(1e-8, 14);
});

it.each(["x^a", "x^(1+1)"])("uses the constant exponent rule at zero for %s", source => {
  expect(evaluate(derivative(parseExpression(source)), 0, { a: 2, b: 0, c: 0 })).toBe(0);
});

it.each([[0, 0], [1, 1], [2, 0], [3, 0]])("specializes exponent a=%s before differentiating at zero", (a, expected) => {
  const variables = { a, b: 0, c: 0 };
  expect(evaluate(derivative(parseExpression("x^a"), variables), 0, variables)).toBe(expected);
});
