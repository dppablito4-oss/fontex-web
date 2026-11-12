import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import {
  agentFailureMessages,
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
      if (response.status === 401 || response.status === 403) {
        throw new Error("Inicia sesión de nuevo para consultar al agente.");
      }
      if (response.status === 404) {
        throw new Error(
          "El agente aún no está disponible en el servidor. Intenta más tarde.",
        );
      }
      if (response.status === 400) {
        throw new Error(
          "No se pudo enviar esta consulta. Prueba con un material más pequeño o una consulta más breve.",
        );
      }
      if (response.status === 422) {
        let failure: unknown;
        try {
          failure = await response.clone().json();
        } catch { /* Older endpoints may not return a code. */ }
        const code = failure && typeof failure === "object" && "code" in failure
          ? failure.code
          : null;
        const message =
          typeof code === "string" && Object.hasOwn(agentFailureMessages, code)
            ? agentFailureMessages[code as keyof typeof agentFailureMessages]
            : "La IA no devolvió una propuesta válida. No se aplicó ningún cambio; vuelve a intentarlo.";
        throw new Error(message);
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
      if (response.status === 502) {
        throw new Error(
          "El proveedor de IA no pudo responder. Intenta de nuevo en unos momentos.",
        );
      }
      if (response.status === 504) {
        throw new Error(
          "La IA tardó demasiado en responder. Intenta con una consulta más breve.",
        );
      }
    }
    if (result.error instanceof FunctionsFetchError) {
      throw new Error(
        "No se pudo conectar con el agente. Comprueba tu conexión e intenta de nuevo.",
      );
    }
    throw new Error(
      "No se pudo obtener una propuesta del agente. El material no cambió.",
    );
  }
  return parseAgentReply(result.data, input.document);
}
