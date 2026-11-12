import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import {
  type AgentRequest,
  parseAgentReply,
  parseAgentRequest,
} from "../../core/agent/protocol";
import { practiceReply } from "../../core/agent/pedagogy";

export async function requestAgent(value: AgentRequest) {
  const input = parseAgentRequest(value);
  if (input.mode === "practice") return practiceReply(input);
  if (!navigator.onLine) {
    throw new Error(
      "No hay conexión. Puedes seguir editando y practicando con el material.",
    );
  }
  if (!supabase) {
    throw new Error(
      "Configura el backend para usar la IA. Studio y la práctica local siguen disponibles.",
    );
  }
  const result = await supabase.functions.invoke<unknown>("studio-agent", {
    body: input,
    timeout: 36_000,
  });
  if (result.error) {
    const response: unknown = result.error instanceof FunctionsHttpError
      ? result.error.context
      : null;
    if (response instanceof Response) {
      if (response.status === 401) {
        throw new Error("Inicia sesión de nuevo para consultar al agente.");
      }
      if (response.status === 429) {
        throw new Error(
          "Alcanzaste el límite de consultas. Intenta más tarde.",
        );
      }
      if (response.status === 503) {
        throw new Error(
          "La IA no está disponible en el servidor. Studio sigue disponible.",
        );
      }
    }
    throw new Error(
      "No se pudo obtener una propuesta del agente. El material no cambió.",
    );
  }
  return parseAgentReply(result.data, input.document);
}
