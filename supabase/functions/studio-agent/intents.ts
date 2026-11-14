import type { AgentRequest } from "../../../src/core/agent/protocol.ts";
import type { ActionBatch } from "../../../src/core/agent/actions.ts";
import { ProposalError } from "./proposal.ts";
const normalized = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const noPlot = (text: string) => /\b(?:no|sin)\s+(?:dibuj\w*|grafic\w*|traz\w*)/.test(text) || /\b(?:solo|unicamente)\b.*\b(?:texto|tarjeta)\b/.test(text) || /^(?:crea|genera)\s+(?:(?:un|una|el|la)\s+)?(?:texto|tarjeta)\b.*\b(?:sobre|explicando|para explicar)\b/.test(text);
const plotRequest = (text: string) => !noPlot(text) && /\b(?:grafica|graficar|dibuja|dibujar|traza|trazar)\b/.test(text) && /\b(?:seno|coseno|tangente|sin|cos|tan|funcion|funciones|parabola|polinomio|polinomios)\b/.test(text);

/** A clear graph request must not report success after adding only explanatory text. */
export function enforceFunctionGraphIntent(input: AgentRequest, batch: ActionBatch) {
  const question = normalized(input.question);
  if (noPlot(question)) return;
  const direct = plotRequest(question);
  const contextual = /\b(?:crea|genera|construye)\b/.test(question) && /acord|conversacion|planead|lo que/.test(question) &&
    (input.history ?? []).some(turn => turn.role === "user" && plotRequest(normalized(turn.content)));
  if (!direct && !contextual) return;
  if (batch.actions.some(action => action.kind !== "delete" && action.object.type === "function-graph")) return;
  if (!direct && input.document.objects.some(object => object.type === "function-graph")) return;
  throw new ProposalError("AI_INVALID_ACTIONS", "La petición requiere una gráfica real. Crea o actualiza function-graph con la función, unidad angular, ventana y puntos acordados; no la sustituyas por una tarjeta de texto ni afirmes haberla dibujado sin ese objeto.");
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function enforceSelectedIntent(input: AgentRequest, batch: ActionBatch) {
  const simple = /^haz más sencillo el módulo seleccionado/i.test(input.question);
  const example = /^crea otro ejemplo del mismo tipo/i.test(input.question);
  const explanation = /^explica(?:me)?\s+(?:solo\s+)?(?:el\s+)?paso\s+\d{1,2}[.!?]?$/i.test(input.question.trim());
  const selected = input.document.objects.find(o => o.id === input.selectedId);
  if (explanation && batch.actions.length) throw new ProposalError("AI_INVALID_ACTIONS", "Explica únicamente el paso solicitado, con actions vacío.");
  if (!simple && !example || !batch.actions.length) return;
  if (!selected) throw new ProposalError("AI_INVALID_ACTIONS", "No hay un módulo seleccionado: responde sin acciones y pide seleccionar uno.");
  if (simple && batch.actions.some(a => a.kind !== "update" || a.object.id !== selected.id)) throw new ProposalError("AI_INVALID_ACTIONS", "Solo puedes actualizar el objeto seleccionado, conservando ID y tipo. No crees, borres ni modifiques otros objetos.");
  if (example && !batch.actions.some(a => a.kind === "create" && a.object.type === selected.type && JSON.stringify(canonical(a.object.data)) !== JSON.stringify(canonical(selected.data)))) throw new ProposalError("AI_INVALID_ACTIONS", "El nuevo ejemplo debe usar datos distintos al módulo seleccionado, además de un ID nuevo.");
  if (example && (batch.actions.some(a => a.kind !== "create" || (a.object.type !== selected.type && a.object.type !== "text")) || !batch.actions.some(a => a.kind === "create" && a.object.type === selected.type))) throw new ProposalError("AI_INVALID_ACTIONS", "Crea otro módulo del mismo tipo, con ID y datos nuevos; solo puedes añadir ese tipo y textos explicativos. No actualices ni borres objetos existentes.");
}
