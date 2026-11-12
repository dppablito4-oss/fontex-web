import { unitDefinitions, type LearningType } from "../math-engine/learning-types.ts";
const integer = (minimum: number, maximum: number) => ({ type: "integer", minimum, maximum });
const enumeration = (...values: string[]) => ({ type: "string", enum: values });
export const learningSchemas = {
  percentage: { part: integer(0, 100), whole: integer(1, 100), quantity: integer(0, 10000), task: enumeration("portion", "discount", "ratio") },
  divisibility: { a: integer(2, 360), b: integer(2, 360), task: enumeration("gcd", "lcm") },
  angle: { degrees: integer(0, 360) },
  circle: { radius: integer(1, 100), task: enumeration("area", "circumference") },
  statistics: { values: { type: "array", minItems: 1, maxItems: 24, items: integer(0, 100) }, task: enumeration("mean", "median", "mode") },
  probability: { experiment: enumeration("coin", "dice", "spinner"), outcomes: integer(2, 12), favorable: integer(0, 12), trials: integer(10, 200), seed: integer(1, 2147483646) },
  "algebra-tiles": { a: integer(0, 8), b: integer(-20, 20), c: integer(0, 8), d: integer(-20, 20) },
  "powers-roots": { base: integer(0, 12), exponent: integer(1, 3), task: enumeration("power", "root") },
  measurement: { value: integer(0, 10000), from: enumeration(...Object.keys(unitDefinitions)), to: enumeration(...Object.keys(unitDefinitions)) },
};
export const learningDataKeys = Object.fromEntries(Object.entries(learningSchemas).map(([type, data]) => [type, Object.keys(data)])) as Record<LearningType, string[]>;
