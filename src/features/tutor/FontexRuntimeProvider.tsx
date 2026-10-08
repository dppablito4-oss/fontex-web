import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  useLocalRuntime,
} from "@assistant-ui/react";
import type { ReactNode } from "react";

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

const initialMessages = [
  {
    role: "assistant" as const,
    content: [
      {
        type: "text" as const,
        text: "Hola, Ana. Estoy listo para ayudarte a conectar ideas entre tus fuentes. En este prototipo las respuestas son simuladas y no se envía información a servicios externos.",
      },
    ],
  },
];

export function FontexRuntimeProvider({ children }: { children: ReactNode }) {
  const runtime = useLocalRuntime(demoAdapter, { initialMessages });
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
