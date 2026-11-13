import { MAX_TEXT_HEIGHT } from "../document-schema/document.ts";
import { learningSchemas } from "./learning-schema.ts";
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const integer = (minimum: number, maximum: number) => ({
  type: "integer",
  minimum,
  maximum,
});
const string = { type: "string" };
const shape = { type: "string", enum: ["bar", "circle"] };
const data = {
  ...learningSchemas,
  polygon: { unit: { type: "string", enum: ["u", "mm", "cm", "m", "km"] }, vertices: { type: "array", minItems: 3, maxItems: 8, items: object({ x: integer(0, 20), y: integer(0, 20) }) } },
  factorization: { number: integer(2, 360) },
  geometry: { figure: { type: "string", enum: ["rectangle", "triangle"] }, base: integer(1, 100), height: integer(1, 100), unit: { type: "string", enum: ["u", "mm", "cm", "m", "km"] } },
  fraction: { numerator: integer(0, 72), denominator: integer(1, 24), shape },
  operation: {
    expression: {
      type: "string",
      description:
        "Dos fracciones con suma, resta o multiplicación: por ejemplo 3/2 × 4/3. Cada factor hasta 3 unidades y denominador 1–24.",
    },
    stage: integer(0, 2),
    shape,
  },
  text: { content: string, fontSize: integer(14, 48) },
  sequence: {
    start: integer(-1000, 1000),
    difference: integer(-100, 100),
    count: integer(2, 8),
  },
  collection: {
    values: {
      type: "array",
      minItems: 1,
      maxItems: 24,
      items: integer(-1000, 1000),
    },
  },
  "number-line": {
    min: integer(-100, 100),
    max: integer(-100, 100),
    step: integer(1, 50),
    points: { type: "array", maxItems: 12, items: integer(-100, 100) },
  },
  "linear-equation": {
    a: integer(-1000, 1000),
    b: integer(-1000, 1000),
    c: integer(-1000, 1000),
    d: integer(-1000, 1000),
    stage: integer(0, 2),
  },
};
export const agentOutputSchema = object({
  message: string,
  actions: {
    type: "array",
    maxItems: 6,
    items: {
      anyOf: [
        object({
          kind: { type: "string", enum: ["create", "update"] },
          object: {
            anyOf: Object.entries(data).map(([type, properties]) =>
              object({
                id: string,
                type: { type: "string", enum: [type] },
                label: string,
                x: { type: "number", minimum: 0, maximum: 1600 },
                y: { type: "number", minimum: 0, maximum: 1000000 },
                width: { type: "number", minimum: 240, maximum: 1600 },
                height: { type: "number", minimum: 160, maximum: ["text", "fraction", "operation"].includes(type) ? MAX_TEXT_HEIGHT : 1100 },
                data: object(properties),
              })
            ),
          },
        }),
        object({ kind: { type: "string", enum: ["delete"] }, id: string }),
      ],
    },
  },
});
