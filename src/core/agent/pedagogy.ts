import { gcd, parseOperation } from "../math-engine/fractions.ts";
import { sequenceTerms } from "../math-engine/sequences.ts";
import type { MathObject } from "../document-schema/document.ts";
import type { AgentLevel, AgentReply, AgentRequest } from "./protocol.ts";
import { analyzeCollection } from "../math-engine/numbers.ts";
import {
  equationResult,
  linearSide,
  solveLinearEquation,
} from "../math-engine/equations.ts";

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
  answer: { n: number; d: number } | "none" | "all";
  prompt: string;
  strategy: string;
  result: string;
};
export function exactTarget(object: MathObject): ExactTarget | null {
  switch (object.type) {
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
      const op = parseOperation(object.data.expression);
      return {
        answer: op.simplified,
        prompt: `Calcula ${object.data.expression}.`,
        strategy:
          "Primero busca divisiones del mismo tamaño; después opera los numeradores y conserva el denominador común.",
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
  const match = attempt.trim().match(/^(-?\d{1,6})(?:\s*\/\s*(-?\d{1,6}))?$/);
  if (!match) return null;
  const n = Number(match[1]), d = Number(match[2] ?? 1);
  if (!d) return null;
  return n * expected.d === expected.n * d;
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
      : equivalentAnswer(request.attempt, target.answer);
    const feedback = answer === true
      ? "Tu respuesta es equivalente al resultado. Explica por qué."
      : answer === false
      ? "Tu respuesta aún no coincide. Revisa un paso."
      : answer === null
      ? (object?.type === "linear-equation"
        ? "Escribe un entero, una fracción a/b, «sin solución» o «infinitas»."
        : "Escribe un entero o una fracción a/b; el denominador debe ser distinto de cero.")
      : "";
    const initialStrategies: Record<MathObject["type"], string> = {
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
      ? initialStrategies[object.type]
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
