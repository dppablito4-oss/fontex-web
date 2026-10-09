import type { ChatModelAdapter } from "@assistant-ui/react";

import { supabase } from "../../lib/supabase/client";

type TutorFunctionResponse = {
  text?: unknown;
  model?: unknown;
};

export const isTutorLive = supabase !== null;

export function toTutorMessages(messages: Parameters<ChatModelAdapter["run"]>[0]["messages"]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ")
        .trim(),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-12);
}

async function readableFunctionError(error: unknown): Promise<string> {
  const fallback = "No fue posible obtener una respuesta de Fontex.";
  if (!error || typeof error !== "object") return fallback;

  const context: unknown = Reflect.get(error, "context");
  if (!(context instanceof Response)) return fallback;

  try {
    const payload: unknown = await context.json();
    if (payload && typeof payload === "object") {
      const message: unknown = Reflect.get(payload, "message");
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

const demoAdapter: ChatModelAdapter = {
  run({ messages, abortSignal }) {
    abortSignal.throwIfAborted();
    const latestQuestion = [...messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.content.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");

    return Promise.resolve({
      content: [
        {
          type: "text",
          text: latestQuestion
            ? `En esta demostración todavía no consulto documentos reales. Para responder “${latestQuestion}” usaría únicamente los fragmentos autorizados que selecciones y mostraría aquí la fuente y la página exactas.`
            : "Selecciona tus fuentes y escribe una pregunta para iniciar.",
        },
      ],
    });
  },
};

const liveAdapter: ChatModelAdapter = {
  async run({ messages, abortSignal }) {
    if (!supabase) throw new Error("Supabase no está configurado en este entorno.");

    const invocation = await supabase.functions.invoke<TutorFunctionResponse>("tutor-chat", {
      body: { messages: toTutorMessages(messages) },
      signal: abortSignal,
      timeout: 45_000,
    });
    const error: unknown = invocation.error;
    const data: unknown = invocation.data;

    if (error) {
      throw new Error(await readableFunctionError(error), { cause: error });
    }

    if (!data || typeof data !== "object") {
      throw new Error("Fontex recibió una respuesta vacía del servidor.");
    }

    const text: unknown = Reflect.get(data, "text");
    const model: unknown = Reflect.get(data, "model");
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Fontex recibió una respuesta vacía del servidor.");
    }

    return {
      content: [{ type: "text", text: text.trim() }],
      metadata: {
        custom: typeof model === "string" ? { model } : undefined,
      },
    };
  },
};

export const tutorAdapter = isTutorLive ? liveAdapter : demoAdapter;

export const tutorInitialMessages = [
  {
    role: "assistant" as const,
    content: [
      {
        type: "text" as const,
        text: isTutorLive
          ? "Hola. La IA de Fontex ya está conectada. En esta etapa puedo ofrecer orientación académica general, pero aún no tengo documentos cargados y no inventaré fuentes ni citas."
          : "Hola. Este entorno no tiene Supabase configurado, así que las respuestas son simuladas y no se envía información a servicios externos.",
      },
    ],
  },
];
