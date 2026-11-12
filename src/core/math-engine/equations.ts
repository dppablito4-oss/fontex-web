import { gcd } from "./fractions.ts";

export type LinearCoefficients = { a: number; b: number; c: number; d: number };
export function solveLinearEquation({ a, b, c, d }: LinearCoefficients) {
  if (
    ![a, b, c, d].every((value) =>
      Number.isInteger(value) && Math.abs(value) <= 1000
    )
  ) throw new Error("Los coeficientes deben ser enteros entre −1000 y 1000.");
  const coefficient = a - c, constant = d - b;
  if (!coefficient) {
    return { kind: constant ? "none" : "all", coefficient, constant } as const;
  }
  const divisor = gcd(constant, coefficient);
  const sign = coefficient < 0 ? -1 : 1;
  return {
    kind: "unique",
    coefficient,
    constant,
    n: sign * constant / divisor,
    d: sign * coefficient / divisor,
  } as const;
}
export function linearSide(coefficient: number, constant: number) {
  if (!coefficient) return String(constant);
  const variable = coefficient === 1
    ? "x"
    : coefficient === -1
    ? "−x"
    : `${coefficient}x`;
  return constant
    ? `${variable} ${constant < 0 ? "−" : "+"} ${Math.abs(constant)}`
    : variable;
}
export function equationResult(
  solution: ReturnType<typeof solveLinearEquation>,
) {
  return solution.kind === "unique"
    ? `${solution.n}${solution.d === 1 ? "" : `/${solution.d}`}`
    : solution.kind === "none"
    ? "Sin solución"
    : "Infinitas soluciones en ℝ";
}
