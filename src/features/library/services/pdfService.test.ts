import { describe, expect, it } from "vitest";

import { MAX_PDF_BYTES, preparePdfFile } from "./pdfService";

describe("PDF validation", () => {
  it("rejects a non-PDF extension", async () => {
    const file = new File(["text"], "notes.txt", { type: "application/pdf" });
    await expect(preparePdfFile(file)).rejects.toThrow(/extensión .pdf/i);
  });

  it("rejects a browser MIME that is not PDF", async () => {
    const file = new File(["%PDF-1.4"], "notes.pdf", { type: "text/plain" });
    await expect(preparePdfFile(file)).rejects.toThrow(/application\/pdf/i);
  });

  it("rejects files larger than five MiB before parsing", async () => {
    const file = new File([new Uint8Array(MAX_PDF_BYTES + 1)], "large.pdf", { type: "application/pdf" });
    await expect(preparePdfFile(file)).rejects.toThrow(/5 MiB/i);
  });

  it("rejects spoofed PDF files without the PDF signature", async () => {
    const file = new File(["not a pdf"], "spoofed.pdf", { type: "application/pdf" });
    await expect(preparePdfFile(file)).rejects.toThrow(/firma/i);
  });
});
