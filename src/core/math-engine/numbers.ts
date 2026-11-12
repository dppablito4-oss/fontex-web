import { gcd } from "./fractions.ts";

export function analyzeCollection(values: readonly number[]) {
  if (
    values.length < 1 || values.length > 24 ||
    values.some((value) => !Number.isInteger(value) || Math.abs(value) > 1000)
  ) throw new Error("Usa de 1 a 24 enteros entre −1000 y 1000.");
  const sum = values.reduce((total, value) => total + value, 0);
  const divisor = gcd(sum, values.length);
  return {
    count: values.length,
    sum,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    mean: { n: sum / divisor, d: values.length / divisor },
  };
}
export function numberLineTicks(
  min: number,
  max: number,
  step: number,
): number[] {
  if (
    ![min, max, step].every(Number.isInteger) || min < -100 || max > 100 ||
    min >= max || step < 1 || step > 50 || (max - min) % step !== 0 ||
    (max - min) / step > 39
  ) {
    throw new Error(
      "Recta: extremos enteros entre −100 y 100, paso 1–50, rango divisible por el paso y hasta 40 marcas.",
    );
  }
  return Array.from(
    { length: (max - min) / step + 1 },
    (_, index) => min + index * step,
  );
}
