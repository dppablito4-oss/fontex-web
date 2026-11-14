import { supabase } from "../../lib/supabase/client";
import { eventData } from "../../core/agent/event-stream";
import {
  type PrimitiveReply,
  type PrimitiveScene,
  replySchema,
} from "../../core/primitives/schema";
export async function requestPrimitiveAgent(
  input: {
    scene: PrimitiveScene;
    question: string;
    task: "chat" | "build";
    level: "inicial" | "primaria" | "secundaria" | "universidad";
    selectedId: string | null;
  },
  onText: (s: string) => void,
  signal: AbortSignal,
): Promise<PrimitiveReply> {
  if (!supabase) {
    throw Error(
      "Inicia sesión para conversar con Fontex AI. Los elementos y las plantillas funcionan sin IA.",
    );
  }
  const result = await supabase.functions.invoke<unknown>(
    "studio-agent/primitives",
    { body: input, signal, timeout: 55000 },
  );
  if (result.error) {
    throw Error(
      "No se pudo consultar al agente. Revisa la sesión y vuelve a intentarlo.",
    );
  }
  const stream = result.data instanceof ReadableStream
    ? result.data
    : result.data instanceof Response
    ? result.data.body
    : null;
  if (!stream) return replySchema.parse(result.data);
  let reply: PrimitiveReply | null = null;
  for await (const event of eventData(stream as ReadableStream<Uint8Array>)) {
    if (!event || typeof event !== "object") continue;
    if (
      "type" in event && event.type === "text" && "text" in event &&
      typeof event.text === "string"
    ) onText(event.text);
    if ("type" in event && event.type === "error" && "message" in event) {
      throw Error(String(event.message));
    }
    if ("type" in event && event.type === "result" && "reply" in event) {
      reply = replySchema.parse(event.reply);
    }
  }
  if (!reply) {
    throw Error(
      "La transmisión terminó sin una propuesta completa. Tu lienzo sigue intacto.",
    );
  }
  return reply;
}
