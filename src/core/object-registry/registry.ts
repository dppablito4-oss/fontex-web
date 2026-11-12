import {
  fitObject,
  uid,
  type MathObject,
  type ObjectType,
  type StudioDocument,
} from "../document-schema/document.ts";

export const objectRegistry = {
  polygon: { name: "Polígonos", width: 1100, height: 720, data: { vertices: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }] } },
  factorization: { name: "Factores primos", width: 1100, height: 720, data: { number: 36 } },
  geometry: { name: "Geometría: áreas", width: 720, height: 640, data: { figure: "rectangle", base: 6, height: 4 } },
  fraction: {
    name: "Fracción",
    width: 440,
    height: 340,
    data: { numerator: 2, denominator: 3, shape: "bar" },
  },
  operation: {
    name: "Operación guiada",
    width: 900,
    height: 600,
    data: { expression: "2/3 + 3/6", stage: 0, shape: "bar" },
  },
  text: {
    name: "Texto",
    width: 560,
    height: 360,
    data: {
      content: "Escribe una explicación o una pregunta para tu clase.",
      fontSize: 22,
    },
  },
  sequence: {
    name: "Sucesión",
    width: 900,
    height: 420,
    data: { start: 2, difference: 2, count: 5 },
  },
  collection: {
    name: "Colección numérica", width: 640, height: 340,
    data: { values: [2, 4, 6, 8] },
  },
  "number-line": {
    name: "Recta numérica", width: 850, height: 320,
    data: { min: -5, max: 5, step: 1, points: [-3, 0, 2] },
  },
  "linear-equation": {
    name: "Ecuación lineal", width: 760, height: 440,
    data: { a: 2, b: 3, c: 0, d: 11, stage: 0 },
  },
} as const;

export function createObject(type: ObjectType, index = 0): MathObject {
  const entry = objectRegistry[type];
  return fitObject({
    id: uid(),
    type,
    label: entry.name,
    x: 60 + (index % 5) * 36,
    y: 60 + (index % 5) * 36,
    width: entry.width,
    height: entry.height,
    data: structuredClone(entry.data),
  } as MathObject);
}

export function createDocument(
  template: "fractions" | "sequences" | "blank" = "fractions",
): StudioDocument {
  const objects: MathObject[] = [];
  if (template !== "blank") {
    const visual = createObject(
      template === "fractions" ? "operation" : "sequence",
    );
    visual.x = 60;
    visual.y = 70;
    const question = createObject("text");
    question.x = 1000;
    question.y = 70;
    question.width = 500;
    question.height = 420;
    if (question.type === "text")
      question.data.content =
        template === "fractions"
          ? "Antes de calcular\n¿Por qué no podemos sumar directamente las piezas de distinto tamaño?\n\nMueve las figuras, homogeneiza y explica qué cantidad se conserva."
          : "Descubre el patrón\n¿Qué cambia de una figura a la siguiente?\n\nPredice el siguiente término y compruébalo cambiando la cantidad de términos.";
    objects.push(visual, question);
  }
  return {
    schemaVersion: 1,
    id: uid(),
    title:
      template === "fractions"
        ? "Fracciones: piezas del mismo tamaño"
        : template === "sequences"
          ? "Sucesiones: descubre el patrón"
          : "Mi nuevo material",
    updatedAt: new Date().toISOString(),
    objects,
  };
}
