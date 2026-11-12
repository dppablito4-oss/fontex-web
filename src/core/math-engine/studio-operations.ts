import { type Fraction, gcd, parseOperation } from "./fractions.ts";

export type FractionProduct = {
  a: Fraction;
  b: Fraction;
  operator: "×";
  total: number;
  denominator: number;
  simplified: Fraction;
};

/** Studio extends the original sum/subtraction laboratory without changing it. */
export function parseStudioOperation(
  input: string,
): ReturnType<typeof parseOperation> | FractionProduct {
  if (input.length > 100) {
    throw new Error("La operación admite hasta 100 caracteres.");
  }
  const match = input.trim().match(
    /^(\d+)\s*\/\s*(\d+)\s*([×*xX·])\s*(\d+)\s*\/\s*(\d+)$/,
  );
  if (!match) return parseOperation(input);
  const a = { n: Number(match[1]), d: Number(match[2]) };
  const b = { n: Number(match[4]), d: Number(match[5]) };
  if (
    ![a.n, a.d, b.n, b.d].every(Number.isSafeInteger) || a.d < 1 || b.d < 1 ||
    a.d > 24 || b.d > 24 || a.n > a.d * 3 || b.n > b.d * 3
  ) {
    throw new Error(
      "Cada factor admite denominadores de 1 a 24 y hasta 3 unidades. El denominador no puede ser cero.",
    );
  }
  const total = a.n * b.n,
    denominator = a.d * b.d,
    divisor = gcd(total, denominator);
  return {
    a,
    b,
    operator: "×",
    total,
    denominator,
    simplified: { n: total / divisor, d: denominator / divisor },
  };
}
