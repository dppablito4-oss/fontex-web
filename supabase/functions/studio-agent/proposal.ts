import {
  exactKeys,
  executeActions,
  parseBatch,
  record,
} from "../../../src/core/agent/actions.ts";
import { agentFailureMessages } from "../../../src/core/agent/protocol.ts";
import type { StudioDocument } from "../../../src/core/document-schema/document.ts";

export class ProposalError extends Error {
  constructor(
    readonly code: keyof typeof agentFailureMessages,
    readonly correction: string,
  ) {
    super(agentFailureMessages[code]);
  }
}
export function readProposal(payload: unknown, document: StudioDocument) {
  if (!record(payload)) {
    throw new ProposalError(
      "AI_INVALID_RESPONSE",
      "Devuelve un objeto JSON completo con message y actions.",
    );
  }
  if (payload.status === "incomplete") {
    throw new ProposalError(
      "AI_INCOMPLETE",
      "La respuesta quedó incompleta. Devuelve una explicación breve y como máximo tres objetos completos, sin Markdown.",
    );
  }
  if (payload.status !== "completed" || !Array.isArray(payload.output)) {
    throw new ProposalError(
      "AI_INVALID_RESPONSE",
      "Devuelve una propuesta completa con message y actions.",
    );
  }
  const content: unknown[] = payload.output.flatMap((item: unknown) =>
    record(item) && item.type === "message" && Array.isArray(item.content)
      ? item.content as unknown[]
      : []
  );
  if (content.some((item) => record(item) && item.type === "refusal")) {
    throw new ProposalError("AI_REFUSAL", "");
  }
  const text = content.map((item) =>
    record(item) && item.type === "output_text" && typeof item.text === "string"
      ? item.text
      : ""
  ).join("");
  if (!text || text.length > 100_000) {
    throw new ProposalError(
      "AI_INVALID_RESPONSE",
      "Devuelve una propuesta JSON breve y completa.",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ProposalError(
      "AI_INVALID_RESPONSE",
      "Devuelve JSON válido, sin bloques de Markdown ni texto fuera del JSON.",
    );
  }
  if (
    !record(value) || !exactKeys(value, ["message", "actions"]) ||
    typeof value.message !== "string" || !value.message.trim() ||
    value.message.length > 4000
  ) {
    throw new ProposalError(
      "AI_INVALID_RESPONSE",
      "Solo se admiten message (texto no vacío, hasta 4000 caracteres) y actions (lista).",
    );
  }
  try {
    const batch = parseBatch({
      documentId: document.id,
      actions: value.actions,
    });
    // Visual size is a user preference; updating mathematics must preserve it.
    for (const action of batch.actions) {
      if (action.kind === "update") {
        const existing = document.objects.find(item => item.id === action.object.id);
        if (existing?.visualScale !== undefined) action.object.visualScale = existing.visualScale;
      }
    }
    // Stack newly generated modules below existing content instead of covering it.
    let bottom = Math.max(20, ...document.objects.map(o => o.y + o.height));
    for (const action of batch.actions) {
      if (action.kind === "create") {
        action.object.y = bottom + 40;
        bottom = action.object.y + action.object.height;
      }
    }
    const next = batch.actions.length
      ? executeActions(document, batch)
      : document;
    return { message: value.message, batch, document: next };
  } catch (error) {
    throw new ProposalError(
      "AI_INVALID_ACTIONS",
      error instanceof Error
        ? error.message
        : "Los objetos deben cumplir el esquema de Studio.",
    );
  }
}
