import { validLengthUnit } from "../math-engine/regular-polygons.ts";
import { parseStudioOperation } from "../math-engine/studio-operations.ts";
import { analyzeCollection, numberLineTicks } from "../math-engine/numbers.ts";
import { solveLinearEquation, type LinearCoefficients } from "../math-engine/equations.ts";

import { type GeometryData } from "../math-engine/geometry.ts";
import { analyzePolygon, analyzeFactors, type PolygonData, type FactorizationData } from "../math-engine/adapted-modules.ts";
import { type LearningPayload, isLearningObject } from "../math-engine/learning-types.ts";
import { validateLearning } from "../math-engine/learning-modules.ts";
export type Shape = "bar" | "circle";
export type FractionData = {
  numerator: number;
  denominator: number;
  shape: Shape;
};
export type OperationData = { expression: string; stage: number; shape: Shape };
export type TextData = { content: string; fontSize: number };
export type SequenceData = { start: number; difference: number; count: number };
export type CollectionData = { values: number[] };
export type NumberLineData = { min: number; max: number; step: number; points: number[] };
export type LinearEquationData = LinearCoefficients & { stage: number };
type ObjectBase = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type MathObject = ObjectBase &
  (
    | LearningPayload
    | { type: "polygon"; data: PolygonData }
    | { type: "factorization"; data: FactorizationData }
    | { type: "geometry"; data: GeometryData }
    | { type: "fraction"; data: FractionData }
    | { type: "operation"; data: OperationData }
    | { type: "text"; data: TextData }
    | { type: "sequence"; data: SequenceData }
    | { type: "collection"; data: CollectionData }
    | { type: "number-line"; data: NumberLineData }
    | { type: "linear-equation"; data: LinearEquationData }
  );
export type ObjectType = MathObject["type"];
export type StudioDocument = {
  schemaVersion: 1;
  id: string;
  title: string;
  updatedAt: string;
  objects: MathObject[];
};
export const BOARD = { width: 1600, height: 1100 };
// Objects retain bounded sizes; the document grows downwards as content is added.
export const MAX_Y = 1_000_000;
export const MAX_TEXT_HEIGHT = 100_000;
export const maxObjectHeight = (object: { type: string }) => object.type === "text" ? MAX_TEXT_HEIGHT : BOARD.height;
export function boardHeight(objects: MathObject[]) {
  return Math.max(BOARD.height, ...objects.map(o => o.y + o.height + 300));
}
export const MAX_OBJECTS = 80;
export const uid = () => crypto.randomUUID();
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const integer = (value: unknown, min: number, max: number) =>
  number(value, min, max) && Number.isInteger(value);
const string = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;

export function validateObject(value: unknown): value is MathObject {
  if (
    !record(value) ||
    !string(value.id, 100) ||
    !value.id ||
    !string(value.label, 120) ||
    !number(value.width, 240, BOARD.width) ||
    !number(value.height, 160, typeof value.type === "string" ? maxObjectHeight({ type: value.type }) : BOARD.height) ||
    !number(value.x, 0, BOARD.width - value.width) ||
    !number(value.y, 0, MAX_Y - value.height) ||
    !record(value.data)
  )
    return false;
  const d = value.data;
  switch (value.type) {
    case "polygon":
      if (d.unit !== undefined && !validLengthUnit(d.unit)) return false;
      try { if (!Array.isArray(d.vertices) || !d.vertices.every(p => record(p) && Object.keys(p).length === 2 && "x" in p && "y" in p)) return false; analyzePolygon(d.vertices as PolygonData["vertices"]); return true; } catch { return false; }
    case "factorization":
      try { analyzeFactors(d.number as number); return true; } catch { return false; }
    case "geometry":
      return (d.unit === undefined || validLengthUnit(d.unit)) && (d.figure === "rectangle" || d.figure === "triangle") && integer(d.base, 1, 100) && integer(d.height, 1, 100);
    case "fraction":
      return (
        integer(d.numerator, 0, 72) &&
        integer(d.denominator, 1, 24) &&
        (d.numerator as number) <= (d.denominator as number) * 3 &&
        (d.shape === "bar" || d.shape === "circle")
      );
    case "operation": {
      if (
        !string(d.expression, 100) ||
        !integer(d.stage, 0, 2) ||
        (d.shape !== "bar" && d.shape !== "circle")
      )
        return false;
      try {
        parseStudioOperation(d.expression);
        return true;
      } catch {
        return false;
      }
    }
    case "text":
      return string(d.content, 5000) && integer(d.fontSize, 14, 48);
    case "sequence":
      return (
        integer(d.start, -1000, 1000) &&
        integer(d.difference, -100, 100) &&
        integer(d.count, 2, 8)
      );
    case "collection":
      try {
        if (!Array.isArray(d.values)) return false;
        analyzeCollection(d.values);
        return true;
      } catch { return false; }
    case "number-line":
      try {
        if (!integer(d.min, -100, 100) || !integer(d.max, -100, 100) || !integer(d.step, 1, 50)
          || !Array.isArray(d.points) || d.points.length > 12 || !d.points.every(point => integer(point, d.min as number, d.max as number)) || new Set(d.points).size !== d.points.length) return false;
        numberLineTicks(d.min as number, d.max as number, d.step as number);
        return true;
      } catch { return false; }
    case "linear-equation":
      try {
        if (![d.a, d.b, d.c, d.d].every(value => integer(value, -1000, 1000)) || !integer(d.stage, 0, 2)) return false;
        solveLinearEquation({ a: d.a as number, b: d.b as number, c: d.c as number, d: d.d as number });
        return true;
      } catch { return false; }
    default:
      return typeof value.type === "string" && isLearningObject({ type: value.type, data: d }) && validateLearning({ type: value.type, data: d } as LearningPayload);
  }
}

export function parseDocument(value: unknown): StudioDocument {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !string(value.id, 100) ||
    !value.id ||
    !string(value.title, 160) ||
    !value.title.trim() ||
    !string(value.updatedAt, 40) ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.objects) ||
    value.objects.length > MAX_OBJECTS ||
    !value.objects.every(validateObject) ||
    new Set(value.objects.map((item) => item.id)).size !== value.objects.length
  ) {
    throw new Error(
      "El material no es un documento válido de Fontex Studio (versión 1).",
    );
  }
  // Copy only supported fields. Imported JSON is data, never executable code.
  return {
    schemaVersion: 1,
    id: value.id,
    title: value.title,
    updatedAt: value.updatedAt,
    objects: value.objects.map(
      (item) =>
        ({
          id: item.id,
          type: item.type,
          label: item.label,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          data: structuredClone(item.data),
        }) as MathObject,
    ),
  };
}

export function fitObject(object: MathObject): MathObject {
  const width = Math.max(240, Math.min(BOARD.width, object.width));
  const height = Math.max(160, Math.min(maxObjectHeight(object), object.height));
  return {
    ...object,
    width,
    height,
    x: Math.max(0, Math.min(BOARD.width - width, object.x)),
    y: Math.max(0, Math.min(MAX_Y - height, object.y)),
  };
}
