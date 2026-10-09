import { describe, expect, it } from "vitest";

import { createPageAwareChunks, normalizeExtractedText } from "../../supabase/functions/_shared/rag/chunking";

describe("RAG page-aware chunking", () => {
  it("normalizes PDF text without losing paragraph boundaries", () => {
    expect(normalizeExtractedText("  ATP\u00ad  celular\r\n\r\n\r\nSegunda línea  ")).toBe("ATP celular\n\nSegunda línea");
  });

  it("keeps page references and bounded overlapping chunks", () => {
    const text = Array.from({ length: 120 }, (_, index) => `Concepto ${index} explica energía celular y fotosíntesis.`).join(" ");
    const chunks = createPageAwareChunks([
      { pageNumber: 4, text },
      { pageNumber: 5, text: "ADN y ARN pertenecen a otra página." },
    ], 120, 20);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(chunks.map((_, index) => index));
    expect(chunks.at(-1)).toMatchObject({ pageStart: 5, pageEnd: 5 });
    expect(chunks.every((chunk) => chunk.content.length <= 560)).toBe(true);
    expect(chunks.every((chunk) => chunk.estimatedTokens > 0)).toBe(true);
  });

  it("does not create chunks for image-only pages", () => {
    expect(createPageAwareChunks([{ pageNumber: 1, text: "  \n " }], 600, 100)).toEqual([]);
  });
});
