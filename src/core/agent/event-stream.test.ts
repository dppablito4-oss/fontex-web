import { expect, it } from "vitest";
import { eventData, partialMessage } from "./event-stream";
it("decodes UTF-8 and CRLF even when each byte arrives separately", async () => {
  const bytes = new TextEncoder().encode('data: {"text":"área 📐"}\r\n\r\ndata: {"done":true}\n\ndata: [DONE]\n\n');
  const body = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
  const values = []; for await (const value of eventData(body)) values.push(value);
  expect(values).toEqual([{ text: "área 📐" }, { done: true }]);
});
it("shows only the partial message and waits for incomplete escaped characters", () => {
  expect(partialMessage('{"message":"El área\\n')).toBe("El área\n");
  expect(partialMessage('{"message":"El \\u00')).toBe("El ");
  expect(partialMessage('{"message":"Usa \\"cm\\"", "actions": [{"kind":"create"}]}')).toBe('Usa "cm"');
  expect(partialMessage('{"actions":[]')).toBe("");
});
