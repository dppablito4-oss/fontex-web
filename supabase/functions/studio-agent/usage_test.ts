import { strict as assert } from "node:assert";
import { createPrimitiveHandler } from "./primitive-handler.ts";
import {
  createPrimitive,
  newPrimitiveScene,
} from "../../../src/core/primitives/schema.ts";
const env = (name: string) =>
  name === "OPENAI_API_KEY" ? "fake-test-key" : undefined;
const request = (scene = newPrimitiveScene()) =>
  new Request("http://local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scene,
      task: "chat",
      question: "Explica",
      level: "secundaria",
      selectedId: null,
    }),
  });
const context = { userClaims: { id: "user" } };
Deno.test("missing or denied usage accounting never calls the provider", async () => {
  let providerCalls = 0;
  const provider: typeof fetch = () => {
    providerCalls++;
    throw Error("must not call");
  };
  assert.equal(
    (await createPrimitiveHandler(env, provider)(request(), context)).status,
    503,
  );
  for (
    const [reason, status] of [["user_rate_limit", 429], ["ai_paused", 503], [
      "beta_invitation_required",
      403,
    ]] as const
  ) {
    const h = createPrimitiveHandler(env, provider, undefined, {
      reserve: () => Promise.resolve({ allowed: false, reason }),
      finish: () => Promise.resolve(),
    });
    assert.equal((await h(request(), context)).status, status);
  }
  assert.equal(providerCalls, 0);
});
Deno.test("large valid scenes are rejected before reserving quota or querying AI", async () => {
  const scene = newPrimitiveScene();
  for (let i = 0; i < 8; i++) {
    const p = createPrimitive("math_block", scene);
    p.data.markdownContent = "x".repeat(10000);
    scene.primitives.push(p);
  }
  let reservations = 0, providerCalls = 0;
  const response = await createPrimitiveHandler(
    env,
    () => {
      providerCalls++;
      throw Error();
    },
    undefined,
    {
      reserve: () => {
        reservations++;
        return Promise.resolve({ allowed: true, reason: "reserved" });
      },
      finish: () => Promise.resolve(),
    },
  )(request(scene), context);
  assert.equal(response.status, 413);
  assert.equal(reservations, 0);
  assert.equal(providerCalls, 0);
});
Deno.test("provider requests have a fixed output budget and release leases after failure", async () => {
  let reserved = 0, finished = 0;
  const h = createPrimitiveHandler(
    env,
    (_url, init) => {
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.max_output_tokens, 2048);
      assert.equal(
        new TextEncoder().encode(String(init?.body)).byteLength + 2048,
        reserved,
      );
      return Promise.resolve(new Response("offline", { status: 503 }));
    },
    undefined,
    {
      reserve: (_u, _id, _task, tokens) => {
        reserved = tokens;
        return Promise.resolve({ allowed: true, reason: "reserved" });
      },
      finish: () => {
        finished++;
        return Promise.resolve();
      },
    },
  );
  await (await h(request(), context)).text();
  assert.equal(finished, 1);
  assert.ok(reserved > 2048 && reserved <= 150000);
});
