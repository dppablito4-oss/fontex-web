import { parseExpression, realRoots, type Expr, type Variables } from "../scene/expression.ts";

export const MAX_POLYNOMIAL_DEGREE = 8;
/** Ascending powers, retaining zero leading terms so the editable degree survives reopening. */
export function polynomialCoefficients(source: string, variables: Variables): number[] | null {
  function coefficients(e: Expr): number[] | null {
    if (e.kind === "number") return [e.value];
    if (e.kind === "variable") return e.name === "x" ? [0, 1] : [variables[e.name as keyof Variables]];
    if (e.kind !== "binary") return null;
    const l = coefficients(e.left), r = coefficients(e.right);
    if (!l || !r) return null;
    if (e.op === "+" || e.op === "-") return Array.from({ length: Math.max(l.length, r.length) }, (_, i) => (l[i] ?? 0) + (e.op === "+" ? 1 : -1) * (r[i] ?? 0));
    if (e.op === "/") return r.length === 1 && r[0] !== 0 ? l.map(n => n / r[0]!) : null;
    function multiply(a: number[], b: number[]) {
      if (a.length + b.length - 2 > MAX_POLYNOMIAL_DEGREE) return null;
      const out = Array<number>(a.length + b.length - 1).fill(0);
      a.forEach((v, i) => b.forEach((w, j) => { out[i + j]! += v * w; }));
      return out;
    }
    if (e.op === "*") return multiply(l, r);
    if (r.length !== 1 || !Number.isInteger(r[0]) || r[0]! < 0 || r[0]! > MAX_POLYNOMIAL_DEGREE) return null;
    let out = [1];
    for (let i = 0; i < r[0]!; i++) { const next = multiply(out, l); if (!next) return null; out = next; }
    return out;
  }
  try {
    const result = coefficients(parseExpression(source));
    return result && result.every(Number.isFinite) ? result : null;
  } catch { return null; }
}
export const isPolynomialEquation = (source: string) => source.includes("=") && !/^\s*(?:y|f\(x\))\s*=/i.test(source);
/** Descending coefficients A, B, C…; numbers go through the expression parser, never executable code. */
export function polynomialSource(values: number[], equation: boolean): string {
  if (values.length < 2 || values.length > MAX_POLYNOMIAL_DEGREE + 1 || !values.every(Number.isFinite)) throw new Error("Revisa los coeficientes del polinomio.");
  return values.map((value, i) => `(${value})${values.length - i > 1 ? `*x^${values.length - i - 1}` : ""}`).join("+") + (equation ? "=0" : "");
}
export function polynomialSolutions(coefficients: number[]): { kind: "all" | "none" | "roots" | "unsupported"; roots: number[] } {
  const values = [...coefficients];
  while (values.length > 1 && values.at(-1) === 0) values.pop();
  if (values.length === 1) return { kind: values[0] === 0 ? "all" : "none", roots: [] };
  if (values.length > 5) return { kind: "unsupported", roots: [] };
  try { const roots = realRoots(values); return { kind: roots.length ? "roots" : "none", roots }; }
  catch { return { kind: "unsupported", roots: [] }; }
}
