import { strict as assert } from "node:assert";
import { extractPdfPages, ProcessingError } from "./pdf.ts";
Deno.test("rejects excess or dishonest page counts before reading any page", async () => {
  for (const [actual, declared] of [[1001, 1], [3, 2], [0, 0]]) {
    let reads = 0, destroyed = 0;
    const task = {
      promise: Promise.resolve({
        numPages: actual,
        getPage: () => {
          reads++;
          throw Error("must not read");
        },
      }),
      destroy: () => {
        destroyed++;
        return Promise.resolve();
      },
    };
    await assert.rejects(
      () => extractPdfPages(task, declared, 10000),
      (e: unknown) =>
        e instanceof ProcessingError && e.code === "page_count_mismatch",
    );
    assert.equal(reads, 0);
    assert.equal(destroyed, 1);
  }
});
Deno.test("extracts valid pages and cleans up on text overflow and timeout", async () => {
  let cleaned = 0, destroyed = 0;
  const task = {
    promise: Promise.resolve({
      numPages: 1,
      getPage: () =>
        Promise.resolve({
          getTextContent: () =>
            Promise.resolve({ items: [{ str: "Texto válido", hasEOL: true }] }),
          cleanup: () => {
            cleaned++;
          },
        }),
    }),
    destroy: () => {
      destroyed++;
      return Promise.resolve();
    },
  };
  assert.equal(
    (await extractPdfPages(task, 1, 100)).pages[0].text,
    "Texto válido",
  );
  await assert.rejects(() => extractPdfPages(task, 1, 2), ProcessingError);
  await assert.rejects(
    () =>
      extractPdfPages({ ...task, promise: new Promise(() => {}) }, 1, 100, 5),
    (e: unknown) =>
      e instanceof ProcessingError && e.code === "pdf_extraction_timeout",
  );
  assert.equal(cleaned, 2);
  assert.equal(destroyed, 3);
});
