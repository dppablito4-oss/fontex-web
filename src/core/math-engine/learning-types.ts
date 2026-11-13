import type { LengthUnit, RegularPolygonData } from "./regular-polygons.ts";
export type Rational = { n: number; d: number };
export type ExactAnswer = Rational | { factors: number[] } | { pi: number } | { values: number[] } | "none" | "all";
export const unitDefinitions = {
  mm: { family: "length", scale: 1, label: "mm" }, cm: { family: "length", scale: 10, label: "cm" }, m: { family: "length", scale: 1000, label: "m" }, km: { family: "length", scale: 1000000, label: "km" },
  mm2: { family: "area", scale: 1, label: "mm²" }, cm2: { family: "area", scale: 100, label: "cm²" }, m2: { family: "area", scale: 1000000, label: "m²" },
  mL: { family: "capacity", scale: 1, label: "mL" }, L: { family: "capacity", scale: 1000, label: "L" },
  s: { family: "time", scale: 1, label: "s" }, min: { family: "time", scale: 60, label: "min" }, h: { family: "time", scale: 3600, label: "h" },
} as const;
export type Unit = keyof typeof unitDefinitions;
export type LearningDataMap = {
  "regular-polygon": RegularPolygonData;
  percentage: { part: number; whole: number; quantity: number; task: "portion" | "discount" | "ratio" };
  divisibility: { a: number; b: number; task: "gcd" | "lcm" };
  angle: { degrees: number };
  circle: { radius: number; task: "area" | "circumference"; unit?: LengthUnit };
  statistics: { values: number[]; task: "mean" | "median" | "mode" };
  probability: { experiment: "coin" | "dice" | "spinner"; outcomes: number; favorable: number; trials: number; seed: number };
  "algebra-tiles": { a: number; b: number; c: number; d: number };
  "powers-roots": { base: number; exponent: number; task: "power" | "root" };
  measurement: { value: number; from: Unit; to: Unit };
};
export type LearningType = keyof LearningDataMap;
export type LearningPayload = { [K in LearningType]: { type: K; data: LearningDataMap[K] } }[LearningType];
export const learningTypes = ["regular-polygon", "percentage", "divisibility", "angle", "circle", "statistics", "probability", "algebra-tiles", "powers-roots", "measurement"] as const;
/** Narrows the type of objects from an already validated Studio document. */
export function isLearningObject(value: { type: string; data: unknown }): value is LearningPayload {
  return (learningTypes as readonly string[]).includes(value.type);
}
