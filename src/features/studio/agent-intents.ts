import type { AgentReply, AgentRequest } from "../../core/agent/protocol";
import { lessonSteps } from "./lesson-steps";
export function explainStepReply(request: AgentRequest): AgentReply | null {
  const match = request.question.trim().match(/^explica(?:me)?\s+(?:solo\s+)?(?:el\s+)?paso\s+(\d{1,2})[.!?]?$/i);
  if (!match) return null;
  const object = request.document.objects.find(o => o.id === request.selectedId);
  if (!object) throw new Error("Selecciona el módulo cuyo paso quieres explicar.");
  const steps = lessonSteps(object, request.level), index = Number(match[1]) - 1;
  const step = steps[index];
  if (!step) throw new Error(`Este módulo tiene ${steps.length} pasos. Elige uno de ellos.`);
  return { message: `Paso ${index + 1}: ${step[0]}\n${step[1]}`, batch: { documentId: request.document.id, actions: [] }, verification: [] };
}
export const isExerciseIntent = (text: string) => /^convierte\s+(?:esto|el módulo seleccionado)\s+en\s+(?:un\s+)?ejercicio[.!?]?$/i.test(text.trim());
