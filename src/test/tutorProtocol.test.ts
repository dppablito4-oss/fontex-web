import { describe, expect, it } from "vitest";
import { buildTutorPrompt, estimateInputTokens, parseMessages, parseModelOutput, type RetrievedChunk } from "../../supabase/functions/tutor-chat/protocol";

const chunk: RetrievedChunk = { chunk_id: 1, document_id: "doc", document_title: "Matemática",
  page_start: 2, page_end: 2, content: "Una fracción representa partes de una unidad.", chunk_version: "v1" };
describe("Contrato documental del tutor", () => {
  it("rechaza texto sin contrato, IDs inventados y preguntas que no sean el último mensaje", () => {
    expect(parseModelOutput("Respuesta [1]", [chunk])).toBeNull();
    expect(parseModelOutput(JSON.stringify({ answer: "Respuesta", cited_chunk_ids: [999] }), [chunk])).toBeNull();
    expect(parseModelOutput(JSON.stringify({ answer: "Respuesta", cited_chunk_ids: [1, 999] }), [chunk])).toBeNull();
    expect(parseMessages([{ role: "user", content: "Pregunta" }, { role: "assistant", content: "Respuesta" }])).toBeNull();
  });
  it("deriva citas del contexto real y elimina repeticiones", () => {
    expect(parseModelOutput(JSON.stringify({ answer: "Explicación", cited_chunk_ids: [1, 1] }), [chunk])?.citations)
      .toEqual([{ chunkId: 1, documentId: "doc", documentTitle: "Matemática", pageStart: 2, pageEnd: 2, chunkVersion: "v1" }]);
  });
  it("presupuesta instrucciones, pregunta multibyte, evidencia e historial conjuntamente", () => {
    const messages = [{ role: "user" as const, content: "Historial extenso ".repeat(300) },
      { role: "assistant" as const, content: "Explicación anterior ".repeat(300) },
      { role: "user" as const, content: "¿Cómo comparo ½ y ⅔?" }];
    const prompt = buildTutorPrompt("Instrucciones", messages, [chunk, { ...chunk, chunk_id: 2, content: "Extenso ".repeat(1000) }], 700)!;
    expect(prompt.chunks.map((source) => source.chunk_id)).toEqual([1]);
    expect(prompt.input).toHaveLength(1);
    expect(prompt.input[0]?.content).toContain("¿Cómo comparo ½ y ⅔?");
    expect(estimateInputTokens("Instrucciones", prompt.input)).toBeLessThanOrEqual(700);
    expect(buildTutorPrompt("Instrucciones".repeat(100), messages, [chunk], 500)).toBeNull();
  });
});
