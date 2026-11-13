import type { ConversationTurn } from "./conversation.ts";
import {
  type ActionBatch,
  exactKeys,
  executeActions,
  parseBatch,
  record,
} from "./actions.ts";
import {
  parseDocument,
  type StudioDocument,
} from "../document-schema/document.ts";

export const agentModes = {
  learn: "Aprender",
  practice: "Practicar",
  solve: "Resolver",
} as const;
export const agentLevels = {
  initial: "Inicial",
  primary: "Primaria",
  secondary: "Secundaria",
  introductory: "Universidad introductoria",
} as const;
export const agentFailureMessages = {
  AI_INCOMPLETE:
    "La IA no terminó de generar el material. Vuelve a intentarlo; tu documento sigue intacto.",
  AI_REFUSAL:
    "La IA no pudo atender esta consulta. Tu documento sigue intacto.",
  AI_INVALID_RESPONSE:
    "No se pudo leer la propuesta de la IA. Vuelve a intentarlo; tu documento sigue intacto.",
  AI_INVALID_ACTIONS:
    "La propuesta no cumple los límites de Studio. No se aplicó ningún cambio; vuelve a intentarlo.",
} as const;
export type AgentMode = keyof typeof agentModes;
export type AgentLevel = keyof typeof agentLevels;
export type AgentRequest = {
  document: StudioDocument;
  selectedId: string | null;
  question: string;
  attempt: string;
  mode: AgentMode;
  level: AgentLevel;
  hintLevel: number;
  history?: ConversationTurn[];
  stream?: boolean;
  task?: "chat" | "build";
};
export type AgentReply = {
  message: string;
  batch: ActionBatch;
  verification: string[];
};
export function parseAgentRequest(value: unknown): AgentRequest {
  if (
    !record(value) ||
    !exactKeys(value, [
      "document",
      "selectedId",
      "question",
      "attempt",
      "mode",
      "level",
      "hintLevel",
      ...(Object.hasOwn(value, "history") ? ["history"] : []),
      ...(Object.hasOwn(value, "stream") ? ["stream"] : []),
      ...(Object.hasOwn(value, "task") ? ["task"] : []),
    ]) ||
    typeof value.mode !== "string" || !Object.hasOwn(agentModes, value.mode) ||
    typeof value.level !== "string" ||
    !Object.hasOwn(agentLevels, value.level) ||
    typeof value.question !== "string" || !value.question.trim() ||
    value.question.length > 1200 ||
    typeof value.attempt !== "string" || value.attempt.length > 1200 ||
    !Number.isInteger(value.hintLevel) || (value.hintLevel as number) < 0 ||
    (value.hintLevel as number) > 2 ||
    (value.selectedId !== null && typeof value.selectedId !== "string")
  ) throw new Error("Consulta del agente inválida.");
  if ((value.stream !== undefined && typeof value.stream !== "boolean") || (value.task !== undefined && value.task !== "chat" && value.task !== "build")) throw new Error("Consulta del agente inválida.");
  if (value.history !== undefined && (!Array.isArray(value.history) || value.history.length > 6 ||
    !value.history.every(turn => record(turn) && exactKeys(turn, ["role", "content"]) &&
      (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string" &&
      turn.content.length > 0 && turn.content.length <= 1200))) throw new Error("Historial del agente inválido.");
  const document = parseDocument(value.document);
  if (
    value.selectedId !== null &&
    !document.objects.some((object) => object.id === value.selectedId)
  ) throw new Error("Selecciona un objeto que exista en este material.");
  return { ...value, document } as AgentRequest;
}
export function parseAgentReply(
  value: unknown,
  document: StudioDocument,
): AgentReply {
  if (
    !record(value) || !exactKeys(value, ["message", "batch", "verification"]) ||
    typeof value.message !== "string" || !value.message.trim() ||
    value.message.length > 4000 ||
    !Array.isArray(value.verification) || value.verification.length > 80 ||
    !value.verification.every((item) =>
      typeof item === "string" && item.length <= 2000
    )
  ) throw new Error("El agente no devolvió una propuesta válida.");
  const batch = parseBatch(value.batch);
  if (batch.documentId !== document.id) {
    throw new Error("La propuesta pertenece a otro material.");
  }
  if (batch.actions.length) executeActions(document, batch);
  return {
    message: value.message,
    batch,
    verification: (value.verification as string[]).slice(),
  };
}
