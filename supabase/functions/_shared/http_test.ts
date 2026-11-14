import { strict as assert } from "node:assert";
import {
  BodyError,
  boundedBytes,
  boundedFormData,
  jsonObject,
} from "./http.ts";
Deno.test("body limits count streamed bytes and cancel excess without Content-Length", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(20));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () =>
      boundedBytes(
        new Request("http://local", { method: "POST", body: stream }),
        10,
      ),
    (e: unknown) => e instanceof BodyError && e.status === 413,
  );
  assert.equal(cancelled, true);
});
Deno.test("JSON rejects null, arrays, scalars and malformed bodies", async () => {
  for (const body of ["null", "[]", "true", "1", '"text"', "{"]) {
    await assert.rejects(
      () =>
        jsonObject(
          new Request("http://local", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          }),
        ),
      BodyError,
    );
  }
  assert.deepEqual(
    await jsonObject(
      new Request("http://local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"documentId":"valid"}',
      }),
    ),
    { documentId: "valid" },
  );
});
Deno.test("multipart limits include extra fields and ignore false declared lengths", async () => {
  for (const declared of [false, true]) {
    const form = new FormData();
    form.set(
      "file",
      new Blob(["%PDF-"], { type: "application/pdf" }),
      "small.pdf",
    );
    form.set("padding", "x".repeat(3000));
    const request = new Request("http://local", { method: "POST", body: form });
    if (declared) request.headers.set("Content-Length", "20");
    await assert.rejects(
      () => boundedFormData(request, 1000),
      (e: unknown) => e instanceof BodyError && e.status === 413,
    );
  }
});
