import { unitOf } from "../math-engine/regular-polygons.ts";
import { gcd } from "../math-engine/fractions.ts";
import { parseStudioOperation } from "../math-engine/studio-operations.ts";
import { sequenceTerms } from "../math-engine/sequences.ts";
import type { MathObject } from "../document-schema/document.ts";
import type { AgentLevel, AgentReply, AgentRequest } from "./protocol.ts";
import { analyzeCollection } from "../math-engine/numbers.ts";
import {
  equationResult,
  linearSide,
  solveLinearEquation,
} from "../math-engine/equations.ts";

import { analyzePolygon, analyzeFactors, factorAnswer } from "../math-engine/adapted-modules.ts";

import { isLearningObject, learningTypes, type LearningType, type ExactAnswer } from "../math-engine/learning-types.ts";
import { learningLesson, symbolicAnswer } from "../math-engine/learning-modules.ts";

export const levelGuidance: Record<AgentLevel, string> = {
  initial:
    "Usa frases cortas, conteo y objetos concretos. Explica los símbolos; pide acompañamiento si el contenido supera el nivel inicial.",
  primary:
    "Relaciona dibujos, unidades y pasos con ejemplos pequeños. Introduce cada término nuevo.",
  secondary:
    "Conecta representaciones, equivalencias y propiedades. Pide justificar un paso.",
  introductory:
    "Explicita supuestos, dominio e invariantes y relaciona representaciones con notación formal, sin asumir cursos avanzados.",
};
const introductions: Record<AgentLevel, string> = {
  initial: "Vamos con un paso pequeño.",
  primary: "Relaciona el dibujo con los números.",
  secondary: "Justifica cada transformación.",
  introductory: "Identifica el dominio y la propiedad que conserva el valor.",
};
export type ExactTarget = {
  answer: ExactAnswer;
  prompt: string;
  strategy: string;
  result: string;
};
export function exactTarget(object: MathObject): ExactTarget | null {
  if (isLearningObject(object)) return learningLesson(object);
  switch (object.type) {
    case "polygon": {
      const p = analyzePolygon(object.data.vertices);
      return { answer: p.areaFraction, prompt: `Calcula el área del polígono en ${unitOf(object.data)}².`, strategy: "Usa los cuadrados de la cuadrícula y divide la figura en partes conocidas; no confundas área y perímetro.", result: String(p.area) };
    }
    case "factorization": {
      const f = analyzeFactors(object.data.number);
      return { answer: { factors: f.factors }, prompt: `Descompón ${object.data.number} en factores primos.`, strategy: "Busca el menor primo que divide exactamente el número y repite con el cociente hasta llegar a 1. Puedes escribir 2 × 2 × 3 o 2^2 × 3.", result: f.expression };
    }
    case "geometry": {
      const { base, height, figure } = object.data;
      const d = figure === "triangle" ? 2 : 1;
      return { answer: { n: base * height, d }, prompt: `Calcula el área en ${unitOf(object.data)}².`, strategy: figure === "triangle" ? "Multiplica base por altura perpendicular y divide entre dos." : "Cuenta las filas y las columnas; multiplica base por altura.", result: `${base * height / d}` };
    }
    case "fraction": {
      const { numerator: n, denominator: d } = object.data;
      const divisor = gcd(n, d);
      return {
        answer: { n, d },
        prompt: "Escribe una fracción equivalente a la figura.",
        strategy:
          "Divide o multiplica el numerador y el denominador por el mismo número distinto de cero.",
        result: `${n / divisor}/${d / divisor}`,
      };
    }
    case "operation": {
      const op = parseStudioOperation(object.data.expression);
      return {
        answer: op.simplified,
        prompt: `Calcula ${object.data.expression}.`,
        strategy: op.operator === "×"
          ? "Multiplica numeradores entre sí y denominadores entre sí; después simplifica. Para multiplicar no hace falta un denominador común."
          : "Primero busca divisiones del mismo tamaño; después opera los numeradores y conserva el denominador común.",
        result: `${op.simplified.n}/${op.simplified.d}`,
      };
    }
    case "sequence": {
      const terms = sequenceTerms(object.data);
      const n = object.data.start + object.data.difference * object.data.count;
      return {
        answer: { n, d: 1 },
        prompt: `¿Qué término sigue después de ${terms.join(", ")}?`,
        strategy:
          `Compara términos consecutivos. La diferencia constante es ${object.data.difference}. Aplica un paso más.`,
        result: String(n),
      };
    }
    case "collection": {
      const { sum } = analyzeCollection(object.data.values);
      return {
        answer: { n: sum, d: 1 },
        prompt: `¿Cuál es la suma de ${object.data.values.join(", ")}?`,
        strategy:
          "Agrupa primero números que se compensan o forman sumas sencillas. Conserva el signo de cada número.",
        result: String(sum),
      };
    }
    case "number-line": {
      const { min, max, step } = object.data;
      const n = (max - min) / step;
      return {
        answer: { n, d: 1 },
        prompt:
          `¿Cuántos intervalos de tamaño ${step} hay entre ${min} y ${max}?`,
        strategy:
          "Calcula la distancia entre los extremos y divídela por el tamaño de cada paso. Cuenta intervalos, no marcas.",
        result: String(n),
      };
    }
    case "linear-equation": {
      const solution = solveLinearEquation(object.data);
      return {
        answer: solution.kind === "unique"
          ? { n: solution.n, d: solution.d }
          : solution.kind,
        prompt: `Resuelve ${linearSide(object.data.a, object.data.b)} = ${
          linearSide(object.data.c, object.data.d)
        } en los reales. Puedes responder «sin solución» o «infinitas».`,
        strategy:
          "Realiza la misma operación en ambos miembros. Agrupa las x y las constantes; si el coeficiente de x es cero, comprueba si la igualdad es posible o siempre cierta.",
        result: equationResult(solution),
      };
    }
    case "text":
      return null;
  }
}
export function equivalentAnswer(
  attempt: string,
  expected: { n: number; d: number },
): boolean | null {
  if (!Number.isSafeInteger(expected.n) || !Number.isSafeInteger(expected.d) || !expected.d) return null;
  const decimal = attempt.trim().match(/^(-?)(\d{1,12})[.,](\d{1,6})$/);
  if (decimal) {
    const scale = 10n ** BigInt(decimal[3]!.length);
    const numerator = (BigInt(decimal[2]!) * scale + BigInt(decimal[3]!)) * (decimal[1] ? -1n : 1n);
    return numerator * BigInt(expected.d) === BigInt(expected.n) * scale;
  }
  const match = attempt.trim().match(/^(-?\d{1,12})(?:\s*\/\s*(-?\d{1,12}))?$/);
  if (!match) return null;
  const n = BigInt(match[1]!), d = BigInt(match[2] ?? "1");
  if (!d) return null;
  return n * BigInt(expected.d) === BigInt(expected.n) * d;
}
export function practiceReply(request: AgentRequest): AgentReply {
  const object = request.document.objects.find((item) =>
    item.id === request.selectedId
  );
  const target = object ? exactTarget(object) : null;
  let message =
    "Selecciona un objeto matemático compatible para practicar. El texto libre no se evalúa automáticamente.";
  if (target) {
    const normalized = request.attempt.trim().toLocaleLowerCase("es").normalize(
      "NFD",
    ).replace(/\p{M}/gu, "");
    const classification = [
      "sin solucion",
      "ninguna",
      "infinitas",
      "infinitas soluciones",
      "todos los reales",
    ].includes(normalized);
    const answer = !normalized
      ? undefined
      : typeof target.answer === "string"
      ? !classification
        ? null
        : target.answer === "none"
        ? ["sin solucion", "ninguna"].includes(normalized)
        : ["infinitas", "infinitas soluciones", "todos los reales"].includes(
          normalized,
        )
      : "pi" in target.answer || "values" in target.answer
      ? symbolicAnswer(request.attempt, target.answer)
      : "factors" in target.answer
      ? factorAnswer(request.attempt, target.answer.factors)
      : equivalentAnswer(request.attempt, target.answer);
    const feedback = answer === true
      ? "Tu respuesta es equivalente al resultado. Explica por qué."
      : answer === false
      ? "Tu respuesta aún no coincide. Revisa un paso."
      : answer === null
      ? (object?.type === "circle" ? "Escribe el resultado exacto con π, por ejemplo 9π o 9*pi." : object?.type === "statistics" && object.data.task === "mode" ? "Escribe todas las modas separadas por comas, o sin moda si no hay datos repetidos." : object?.type === "factorization" ? "Escribe un producto de primos, por ejemplo 2 × 2 × 3 o 2^2 × 3." : object?.type === "linear-equation" || object?.type === "algebra-tiles"
        ? "Escribe un entero, un decimal, una fracción a/b, «sin solución» o «infinitas»."
        : "Escribe un entero, un decimal o una fracción a/b; el denominador debe ser distinto de cero.")
      : "";
    const initialStrategies: Record<MathObject["type"], string> = {
      ...Object.fromEntries(learningTypes.map(type => [type, "Observa el dibujo y cuenta las unidades con acompañamiento. Relaciona cada cambio con la pregunta."])) as Record<LearningType, string>,
      "regular-polygon": "Cuenta los lados iguales y recorre el borde sin saltarte ninguno.",
      polygon: "Cuenta cuadrados completos y junta las partes de cuadrados de la figura.",
      factorization: "Empieza probando grupos de dos y pide acompañamiento para las divisiones.",
      geometry: "Cuenta los cuadrados de cada fila. Dos triángulos iguales forman un rectángulo.",
      fraction:
        "Cuenta las partes coloreadas y las partes de una unidad. Pide ayuda para escribir esos dos números como una fracción.",
      operation:
        "Observa las piezas. Solo junta o quita piezas del mismo tamaño; pide ayuda para dividirlas en partes iguales.",
      sequence: "Mira qué cambia de un grupo al siguiente. Cuenta un paso más.",
      collection:
        "Cuenta con objetos concretos. Para números negativos, pide ayuda para representar lo que falta.",
      "number-line":
        "Da saltos iguales entre las dos puntas. Cuenta los saltos, no las rayitas.",
      "linear-equation":
        "x es un número escondido. Haz el mismo cambio en los dos lados de la igualdad; pide acompañamiento para los símbolos.",
      text: "Observa el material con acompañamiento.",
    };
    const strategy = request.level === "initial" && object
      ? object.type === "operation" &&
          parseStudioOperation(object.data.expression).operator === "×"
        ? "Multiplicar por una fracción significa tomar esa parte de otra cantidad. Usa dibujos y pide acompañamiento para los símbolos."
        : initialStrategies[object.type]
      : target.strategy;
    const hint = request.hintLevel === 0
      ? target.prompt
      : request.hintLevel === 1
      ? strategy
      : `Comprobación: ${target.result}. ${strategy}`;
    message = `${introductions[request.level]} ${feedback} ${hint}`.replace(
      / +/g,
      " ",
    ).trim();
  }
  return {
    message,
    batch: { documentId: request.document.id, actions: [] },
    verification: [],
  };
}
