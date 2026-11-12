import {
  BOARD,
  MAX_Y,
  type MathObject,
  MAX_OBJECTS,
  parseDocument,
  type StudioDocument,
  validateObject,
} from "../document-schema/document.ts";
import { objectRegistry } from "../object-registry/registry.ts";
import { gcd } from "../math-engine/fractions.ts";
import { parseStudioOperation } from "../math-engine/studio-operations.ts";
import { sequenceTerms } from "../math-engine/sequences.ts";
import { analyzeCollection, numberLineTicks } from "../math-engine/numbers.ts";
import { solveLinearEquation } from "../math-engine/equations.ts";

import { analyzePolygon, analyzeFactors } from "../math-engine/adapted-modules.ts";

export type StudioAction =
  | { kind: "create"; object: MathObject }
  | { kind: "update"; object: MathObject }
  | { kind: "delete"; id: string };
export type ActionBatch = { documentId: string; actions: StudioAction[] };
export const MAX_ACTIONS = 20;

export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  return Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}
const dataKeys: Record<MathObject["type"], string[]> = {
  polygon: ["vertices"],
  factorization: ["number"],
  geometry: ["figure", "base", "height"],
  fraction: ["numerator", "denominator", "shape"],
  operation: ["expression", "stage", "shape"],
  text: ["content", "fontSize"],
  sequence: ["start", "difference", "count"],
  collection: ["values"],
  "number-line": ["min", "max", "step", "points"],
  "linear-equation": ["a", "b", "c", "d", "stage"],
};
function strictObject(value: unknown): value is MathObject {
  return validateObject(value) &&
    exactKeys(value, [
      "id",
      "type",
      "label",
      "x",
      "y",
      "width",
      "height",
      "data",
    ]) &&
    exactKeys(value.data, dataKeys[value.type]);
}
export function parseBatch(value: unknown): ActionBatch {
  if (
    !record(value) || !exactKeys(value, ["documentId", "actions"]) ||
    typeof value.documentId !== "string" || !value.documentId ||
    value.documentId.length > 100 ||
    !Array.isArray(value.actions) || value.actions.length > MAX_ACTIONS
  ) {
    throw new Error(
      `El lote debe indicar el material y hasta ${MAX_ACTIONS} acciones.`,
    );
  }
  for (const [index, action] of value.actions.entries()) {
    if (!record(action)) throw new Error("Acción inválida.");
    if (action.kind === "delete") {
      if (
        !exactKeys(action, ["kind", "id"]) || typeof action.id !== "string" ||
        !action.id || action.id.length > 100
      ) {
        throw new Error("La eliminación debe indicar un objeto válido.");
      }
    } else if (action.kind === "create" || action.kind === "update") {
      if (
        !exactKeys(action, ["kind", "object"]) || !strictObject(action.object)
      ) {
        let hint =
          "Revisa los campos obligatorios, tipos y límites; no se admiten campos adicionales.";
        const candidate = action.object;
        if (record(candidate)) {
          if (candidate.type === "fraction") {
            hint =
              "fraction: numerador entero ≥0, denominador entero 1–24 y valor ≤3 unidades; representa productos mayores con operation.";
          }
          if (
            candidate.type === "operation" && record(candidate.data) &&
            typeof candidate.data.expression === "string"
          ) {
            try {
              parseStudioOperation(candidate.data.expression);
            } catch (error) {
              hint = error instanceof Error ? error.message : hint;
            }
          }
          if (
            [candidate.x, candidate.y, candidate.width, candidate.height].every(
              (value) => typeof value === "number",
            ) &&
            ((candidate.x as number) + (candidate.width as number) >
                BOARD.width ||
              (candidate.y as number) + (candidate.height as number) >
                MAX_Y)
          ) {
            hint =
              "El objeto debe caber en el lienzo: x + width ≤1600 e y + height ≤1000000. Usa los tamaños iniciales y ajusta su posición.";
          }
        }
        throw new Error(
          `El objeto propuesto no cumple el esquema de Studio. Acción ${
            index + 1
          }: ${hint}`,
        );
      }
    } else {throw new Error(
        "Acción no permitida. Solo se admite crear, modificar o eliminar objetos.",
      );}
  }
  return structuredClone(value) as ActionBatch;
}

/** Pure transaction: validate every action before committing one document to history. */
export function executeActions(
  document: StudioDocument,
  input: unknown,
  expected?: StudioDocument,
): StudioDocument {
  const current = parseDocument(document);
  const batch = parseBatch(input);
  if (
    batch.documentId !== current.id ||
    (expected &&
      JSON.stringify(current) !== JSON.stringify(parseDocument(expected)))
  ) {
    throw new Error(
      "El material cambió. Lee el contexto y prepara de nuevo las acciones.",
    );
  }
  if (!batch.actions.length) throw new Error("El lote no contiene cambios.");
  let objects = current.objects;
  for (const action of batch.actions) {
    const id = action.kind === "delete" ? action.id : action.object.id;
    const existing = objects.find((object) => object.id === id);
    if (action.kind === "create") {
      if (existing) {
        throw new Error("Ya existe un objeto con ese identificador.");
      }
      objects = [...objects, action.object];
    } else {
      if (!existing) {
        throw new Error("El objeto que se quiere cambiar ya no existe.");
      }
      if (action.kind === "delete") {
        objects = objects.filter((object) => object.id !== id);
      } else {
        if (existing.type !== action.object.type) {
          throw new Error(
            "No se puede cambiar el tipo de un objeto existente.",
          );
        }
        objects = objects.map((object) =>
          object.id === id ? action.object : object
        );
      }
    }
  }
  return parseDocument({
    ...current,
    objects,
    updatedAt: new Date().toISOString(),
  });
}

export function readStudioContext(
  document: StudioDocument,
  selectedId: string | null = null,
) {
  const snapshot = parseDocument(structuredClone(document));
  return {
    document: snapshot,
    selectedId: snapshot.objects.some((object) => object.id === selectedId)
      ? selectedId
      : null,
    supportedTypes: Object.keys(objectRegistry),
    creationDefaults: structuredClone(objectRegistry),
    limits: {
      board: { ...BOARD },
      maxObjects: MAX_OBJECTS,
      maxActions: MAX_ACTIONS,
      fractions:
        "Numerador entero no negativo, denominador 1–24, valor hasta 3 unidades.",
      operations:
        "Dos fracciones con +, − o ×; cada factor de hasta 3 unidades y denominador 1–24. Suma/resta: m.c.m. ≤60 y resultado ≥0. Multiplicación: resultado hasta 9 unidades; usar operation para el producto, no un objeto fraction si supera sus límites.",
    },
    mathematics: snapshot.objects.map((object) => {
      switch (object.type) {
        case "polygon": return { id: object.id, polygon: analyzePolygon(object.data.vertices) };
        case "factorization": return { id: object.id, factorization: analyzeFactors(object.data.number) };
        case "geometry":
          return { id: object.id, area: { n: object.data.base * object.data.height, d: object.data.figure === "triangle" ? 2 : 1 } };
        case "fraction": {
          const divisor = gcd(object.data.numerator, object.data.denominator);
          return {
            id: object.id,
            simplified: {
              n: object.data.numerator / divisor,
              d: object.data.denominator / divisor,
            },
          };
        }
        case "operation":
          return {
            id: object.id,
            operation: parseStudioOperation(object.data.expression),
          };
        case "sequence":
          return { id: object.id, terms: sequenceTerms(object.data) };
        case "collection":
          return {
            id: object.id,
            collection: analyzeCollection(object.data.values),
          };
        case "number-line":
          return {
            id: object.id,
            ticks: numberLineTicks(
              object.data.min,
              object.data.max,
              object.data.step,
            ),
          };
        case "linear-equation":
          return { id: object.id, solution: solveLinearEquation(object.data) };
        case "text":
          return { id: object.id };
      }
    }),
  };
}
