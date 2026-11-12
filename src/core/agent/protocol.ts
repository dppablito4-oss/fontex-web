import { exactKeys, executeActions, parseBatch, record, type ActionBatch } from "./actions.ts";
import { parseDocument, type StudioDocument } from "../document-schema/document.ts";

export const agentModes = { learn: "Aprender", practice: "Practicar", solve: "Resolver" } as const;
export const agentLevels = { initial: "Inicial", primary: "Primaria", secondary: "Secundaria", introductory: "Universidad introductoria" } as const;
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
};
export type AgentReply = { message: string; batch: ActionBatch; verification: string[] };
export function parseAgentRequest(value: unknown): AgentRequest {
  if (!record(value) || !exactKeys(value, ["document", "selectedId", "question", "attempt", "mode", "level", "hintLevel"])
    || typeof value.mode !== "string" || !Object.hasOwn(agentModes, value.mode)
    || typeof value.level !== "string" || !Object.hasOwn(agentLevels, value.level)
    || typeof value.question !== "string" || !value.question.trim() || value.question.length > 1200
    || typeof value.attempt !== "string" || value.attempt.length > 1200
    || !Number.isInteger(value.hintLevel) || (value.hintLevel as number) < 0 || (value.hintLevel as number) > 2
    || (value.selectedId !== null && typeof value.selectedId !== "string")) throw new Error("Consulta del agente inválida.");
  const document = parseDocument(value.document);
  if (value.selectedId !== null && !document.objects.some(object => object.id === value.selectedId)) throw new Error("Selecciona un objeto que exista en este material.");
  return { ...value, document } as AgentRequest;
}
export function parseAgentReply(value: unknown, document: StudioDocument): AgentReply {
  if (!record(value) || !exactKeys(value, ["message", "batch", "verification"])
    || typeof value.message !== "string" || !value.message.trim() || value.message.length > 4000
    || !Array.isArray(value.verification) || value.verification.length > 80
    || !value.verification.every(item => typeof item === "string" && item.length <= 2000)) throw new Error("El agente no devolvió una propuesta válida.");
  const batch = parseBatch(value.batch);
  if (batch.documentId !== document.id) throw new Error("La propuesta pertenece a otro material.");
  if (batch.actions.length) executeActions(document, batch);
  return { message: value.message, batch, verification: (value.verification as string[]).slice() };
}
