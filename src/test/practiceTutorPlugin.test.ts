import { describe, expect, it } from "vitest";

import { createPayload, readReply } from "../../practiceTutorPlugin";

describe("Modelos del tutor Fontex", () => {
  it("usa Luna para chat y Sol para estudio, con material obligatorio", () => {
    expect(createPayload({ mode: "chat", topic: "fracciones", question: "¿Cómo organizo mi práctica?" })?.model).toBe("gpt-6-luna");
    expect(createPayload({ mode: "study", topic: "fracciones", question: "¿Qué es una fracción?" })).toBeNull();
    const coach = createPayload({ mode: "study", topic: "fracciones", exercise: 0, answer: 0 });
    expect(coach?.model).toBe("gpt-6.1-sol");
    expect(coach?.input).toContain("multiplica el numerador y el denominador");
    expect(coach?.input).toContain("Duplicaste solo el denominador");
  });

  it("limita la búsqueda web y rechaza respuestas sin citas autorizadas", () => {
    const payload = createPayload({ mode: "web", topic: "decimales", question: "¿Cómo comparo dos decimales?" });
    expect(payload?.model).toBe("gpt-6.1-sol");
    expect(payload?.tool_choice).toBe("required");
    expect(payload?.tools?.[0]?.filters.allowed_domains).toContain("khanacademy.org");

    const reply = (url: string) => readReply({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "Compara por valor posicional.", annotations: [{ type: "url_citation", url }] }] }],
    }, true);
    expect(reply("https://khanacademy.org.example.com/decimales")).toBeNull();
    expect(reply("https://es.khanacademy.org/math")?.sources[0]?.url).toBe("https://es.khanacademy.org/math");
  });
});
