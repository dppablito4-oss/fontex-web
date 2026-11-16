import { strict as assert } from "node:assert";
import agent from "./index.ts";
import { withPrimitiveContract } from "./release.ts";
import { parsePrimitiveScene } from "../../../src/core/primitives/schema.ts";
import { templateScene } from "../../../src/core/primitives/templates.ts";

Deno.test("the deployed preflight advertises a validator that accepts practice scenes", async () => {
  const response = await agent.fetch(new Request("https://local/studio-agent", {
    method: "OPTIONS",
    headers: {
      Origin: "https://fontex-release-check.invalid",
      "Access-Control-Request-Method": "POST",
    },
  }));
  assert.ok([200, 204].includes(response.status));
  assert.equal(response.headers.get("x-fontex-agent-contract"), "primitive-agent-v4");
  assert.ok(response.headers.get("access-control-allow-origin"));
  const scene = parsePrimitiveScene(templateScene("practice-line"));
  assert.ok(scene.primitives.some(p => p.kind === "answer_field"));
  assert.ok(scene.primitives.some(p => p.interaction?.fields.length));
});

Deno.test("release metadata does not bypass the authenticated handler or buffer its stream", async () => {
  const denied = new Response("Sign in", { status: 401 });
  const request = new Request("https://local/studio-agent", { method: "POST" });
  assert.equal(await withPrimitiveContract(() => denied)(request), denied);
  const stream = new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("data: ok\n\n")); c.close(); } }), {
    headers: { "Content-Type": "text/event-stream" },
  });
  const result = await withPrimitiveContract(() => stream)(request);
  assert.equal(result, stream);
  assert.equal(await result.text(), "data: ok\n\n");
});
