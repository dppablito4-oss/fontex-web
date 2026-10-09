import type { ThreadMessage } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";

import { toTutorMessages } from "./tutorRuntime";

function message(role: "assistant" | "user", text: string): ThreadMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content: [{ type: "text", text }],
    createdAt: new Date(),
  } as unknown as ThreadMessage;
}

describe("Fontex tutor request", () => {
  it("serializa únicamente el texto de usuario y asistente", () => {
    expect(toTutorMessages([message("assistant", "Hola"), message("user", "  Mi pregunta  ")])).toEqual([
      { role: "assistant", content: "Hola" },
      { role: "user", content: "Mi pregunta" },
    ]);
  });

  it("limita el historial enviado a los doce mensajes más recientes", () => {
    const messages = Array.from({ length: 15 }, (_, index) => message("user", `Pregunta ${index}`));

    const result = toTutorMessages(messages);

    expect(result).toHaveLength(12);
    expect(result[0]?.content).toBe("Pregunta 3");
    expect(result.at(-1)?.content).toBe("Pregunta 14");
  });
});
