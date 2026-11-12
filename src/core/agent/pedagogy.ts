import { gcd, parseOperation } from "../math-engine/fractions.ts";
import { sequenceTerms } from "../math-engine/sequences.ts";
import type { MathObject } from "../document-schema/document.ts";
import type { AgentLevel, AgentReply, AgentRequest } from "./protocol.ts";

export const levelGuidance: Record<AgentLevel, string> = {
  initial: "Usa frases cortas, conteo y objetos concretos. Explica los símbolos; pide acompañamiento si el contenido supera el nivel inicial.",
  primary: "Relaciona dibujos, unidades y pasos con ejemplos pequeños. Introduce cada término nuevo.",
  secondary: "Conecta representaciones, equivalencias y propiedades. Pide justificar un paso.",
  introductory: "Explicita supuestos, dominio e invariantes y relaciona representaciones con notación formal, sin asumir cursos avanzados.",
};
const introductions: Record<AgentLevel, string> = {
  initial: "Vamos con un paso pequeño.", primary: "Relaciona el dibujo con los números.",
  secondary: "Justifica cada transformación.", introductory: "Identifica el dominio y la propiedad que conserva el valor.",
};
export type ExactTarget = { n: number; d: number; prompt: string; strategy: string; result: string };
export function exactTarget(object: MathObject): ExactTarget | null {
  switch (object.type) {
    case "fraction": {
      const { numerator: n, denominator: d } = object.data;
      const divisor = gcd(n, d);
      return { n, d, prompt: "Escribe una fracción equivalente a la figura.", strategy: "Divide o multiplica el numerador y el denominador por el mismo número distinto de cero.", result: `${n / divisor}/${d / divisor}` };
    }
    case "operation": {
      const op = parseOperation(object.data.expression);
      return { ...op.simplified, prompt: `Calcula ${object.data.expression}.`, strategy: "Primero busca divisiones del mismo tamaño; después opera los numeradores y conserva el denominador común.", result: `${op.simplified.n}/${op.simplified.d}` };
    }
    case "sequence": {
      const terms = sequenceTerms(object.data);
      const n = object.data.start + object.data.difference * object.data.count;
      return { n, d: 1, prompt: `¿Qué término sigue después de ${terms.join(", ")}?`, strategy: `Compara términos consecutivos. La diferencia constante es ${object.data.difference}. Aplica un paso más.`, result: String(n) };
    }
    case "text": return null;
  }
}
export function equivalentAnswer(attempt: string, expected: { n: number; d: number }): boolean | null {
  const match = attempt.trim().match(/^(-?\d{1,6})(?:\s*\/\s*(-?\d{1,6}))?$/);
  if (!match) return null;
  const n = Number(match[1]), d = Number(match[2] ?? 1);
  if (!d) return null;
  return n * expected.d === expected.n * d;
}
export function practiceReply(request: AgentRequest): AgentReply {
  const object = request.document.objects.find(item => item.id === request.selectedId);
  const target = object ? exactTarget(object) : null;
  let message = "Selecciona un objeto matemático compatible para practicar. El texto libre no se evalúa automáticamente.";
  if (target) {
    const answer = request.attempt.trim() ? equivalentAnswer(request.attempt, target) : undefined;
    const feedback = answer === true ? "Tu respuesta es equivalente al resultado. Explica por qué."
      : answer === false ? "Tu respuesta aún no coincide. Revisa un paso."
      : answer === null ? "Escribe un entero o una fracción a/b; el denominador debe ser distinto de cero." : "";
    const hint = request.hintLevel === 0 ? target.prompt : request.hintLevel === 1 ? target.strategy : `Comprobación: ${target.result}. ${target.strategy}`;
    message = `${introductions[request.level]} ${feedback} ${hint}`.replace(/ +/g, " ").trim();
  }
  return { message, batch: { documentId: request.document.id, actions: [] }, verification: [] };
}
