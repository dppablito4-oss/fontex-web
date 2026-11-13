import {
  eventData,
  partialMessage,
} from "../../../src/core/agent/event-stream.ts";
import { record } from "../../../src/core/agent/actions.ts";
import { ProposalError } from "./proposal.ts";

export async function streamedProposal(
  response: Response,
  emit: (text: string) => void,
): Promise<unknown> {
  if (!response.body) {
    throw new ProposalError("AI_INCOMPLETE", "Falta la respuesta.");
  }
  let output = "", visible = "";
  try {
    for await (const event of eventData(response.body)) {
      if (!record(event)) continue;
      if (
        event.type === "response.output_text.delta" &&
        typeof event.delta === "string"
      ) {
        output += event.delta;
        if (output.length > 1_000_000) {
          throw new ProposalError(
            "AI_INVALID_RESPONSE",
            "Respuesta demasiado grande.",
          );
        }
        const text = partialMessage(output);
        if (text !== visible) {
          visible = text;
          emit(text);
        }
      }
      if (event.type === "response.completed") return event.response;
      if (
        event.type === "response.incomplete" ||
        event.type === "response.failed" || event.type === "error"
      ) {
        throw new ProposalError("AI_INCOMPLETE", "La respuesta no terminó.");
      }
    }
  } catch (error) {
    if (error instanceof ProposalError) throw error;
    throw new ProposalError(
      "AI_INCOMPLETE",
      "La transmisión se interrumpió. Genera uno o dos módulos completos.",
    );
  }
  throw new ProposalError(
    "AI_INCOMPLETE",
    "La conexión terminó antes de completar la respuesta.",
  );
}
