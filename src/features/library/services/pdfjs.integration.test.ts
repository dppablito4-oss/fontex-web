// @vitest-environment node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

function createSelectablePdf() {
  const encoder = new TextEncoder();
  const stream = "BT /F1 18 Tf 72 720 Td (Fontex PDF real) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(pdf);
}

describe("PDF.js real document", () => {
  it("opens a selectable PDF and exposes its page text", async () => {
    GlobalWorkerOptions.workerSrc = pathToFileURL(
      resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ).href;
    const loadingTask = getDocument({ data: createSelectablePdf(), stopAtErrors: true });
    try {
      const pdf = await loadingTask.promise;
      expect(pdf.numPages).toBe(1);
      const page = await pdf.getPage(1);
      const text = await page.getTextContent();
      expect(text.items.some((item) => "str" in item && item.str.includes("Fontex PDF real"))).toBe(true);
      page.cleanup();
    } finally {
      await loadingTask.destroy();
    }
  });
});
