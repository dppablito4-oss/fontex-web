import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";
import { createTutorHandler } from "./handler.ts";
import { ABSTENTION } from "./protocol.ts";

type Scenario = {
  upstreamStatus?: number;
  empty?: boolean;
  text?: string;
  createFailure?: boolean;
  searchFailure?: boolean;
  saveFailure?: boolean;
  completionFailures?: number;
  healthFailure?: boolean;
  budget?: number;
};
async function run(scenario: Scenario = {}, health = false) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let completionAttempts = 0, responsesCalled = 0;
  let active = false;
  const dbFetch: typeof fetch = (input, init) =>
    Promise.resolve((() => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const name = url.pathname.split("/").at(-1)!;
      const args = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      if (url.pathname.includes("/rpc/")) {
        calls.push({ name, args });
        if (name === "internal_begin_tutor_request") {
          active = true;
          return Response.json({
            event_id: "event",
            max_retrieved_chunks: 5,
            max_input_tokens: scenario.budget ?? 8000,
            max_output_tokens: 1500,
            default_model: "test-model",
            reasoning_effort: "low",
          });
        }
        if (name === "internal_search_tutor_chunks") {
          return scenario.searchFailure
            ? Response.json({ message: "search failed" }, { status: 503 })
            : Response.json([{
              chunk_id: 1,
              document_id: "doc",
              document_title: "Matemática",
              page_start: 1,
              page_end: 1,
              content: "Una fracción representa partes de una unidad.",
              chunk_version: "v1",
            }]);
        }
        if (name === "internal_store_tutor_exchange") {
          return scenario.saveFailure
            ? Response.json({ message: "save failed" }, { status: 503 })
            : Response.json({
              message_id: "assistant-id",
              user_message_id: "user-id",
            });
        }
        if (name === "internal_complete_tutor_request") {
          completionAttempts++;
          if (
            completionAttempts <= (scenario.completionFailures ?? 0)
          ) return Response.json({ message: "retry" }, { status: 503 });
          active = false;
          return Response.json(null);
        }
      }
      if (name === "tutor_limits") {
        return scenario.healthFailure
          ? Response.json({ message: "limits unavailable" }, { status: 503 })
          : Response.json({
            is_enabled: true,
            default_model: "test-model",
            max_output_tokens: 1500,
          });
      }
      if (name === "tutor_conversations") {
        return scenario.createFailure
          ? Response.json({ message: "creation failed" }, { status: 503 })
          : Response.json({ id: "conversation" });
      }
      throw new Error(`Unexpected database request ${url}`);
    })());
  const original = globalThis.fetch;
  globalThis.fetch = (input) => {
    if (String(input).endsWith("/embeddings")) {
      return Promise.resolve(
        Response.json({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 5 },
        }),
      );
    }
    responsesCalled++;
    if (scenario.upstreamStatus) {
      return Promise.resolve(
        new Response("provider unavailable", {
          status: scenario.upstreamStatus,
        }),
      );
    }
    return Promise.resolve(
      Response.json({
        status: "completed",
        output: scenario.empty ? [] : [{
          content: [{
            type: "output_text",
            text: scenario.text ??
              JSON.stringify({
                answer: "Explicación respaldada",
                cited_chunk_ids: [1],
              }),
          }],
        }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    );
  };
  try {
    const handler = createTutorHandler((name) =>
      name === "OPENAI_API_KEY"
        ? "test-key"
        : name === "EMBEDDING_DIMENSIONS"
        ? "1"
        : undefined
    );
    const response = await handler(
      new Request("https://example.test/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          health ? { action: "health" } : {
            classroomId: "classroom",
            messages: [{ role: "user", content: "¿Qué es una fracción?" }],
          },
        ),
      }),
      {
        userClaims: { id: "user" },
        supabaseAdmin: createClient("https://database.test", "test-key", {
          global: { fetch: dbFetch },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }),
      },
    );
    return {
      status: response.status,
      body: await response.json(),
      calls,
      active,
      completionAttempts,
      responsesCalled,
    };
  } finally {
    globalThis.fetch = original;
  }
}

for (
  const [label, scenario] of Object.entries<Scenario>({
    "provider 429": { upstreamStatus: 429 },
    "provider 500": { upstreamStatus: 500 },
    "empty provider response": { empty: true },
    "conversation creation": { createFailure: true },
    "retrieval failure": { searchFailure: true },
    "exchange persistence": { saveFailure: true },
  })
) {
  Deno.test(`releases quota after ${label}`, async () => {
    const result = await run(scenario);
    assert.ok(result.status >= 500);
    assert.equal(result.active, false);
    assert.equal(result.calls.at(-1)?.args.result_status, "failed");
    assert.equal(result.completionAttempts, 1);
  });
}
Deno.test("completes successful exchange and retries lost quota completion", async () => {
  const result = await run({ completionFailures: 1 });
  assert.equal(result.status, 200);
  assert.equal(result.body.messageId, "assistant-id");
  assert.equal(result.active, false);
  assert.equal(result.completionAttempts, 2);
  assert.equal(result.calls.at(-1)?.args.result_status, "completed");
});
Deno.test("reports failed quota completion instead of silently succeeding", async () => {
  const result = await run({ completionFailures: 2 });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "QUOTA_COMPLETION_FAILED");
});
for (
  const text of [
    "Texto sin contrato",
    JSON.stringify({ answer: "Sin citas", cited_chunk_ids: [] }),
    JSON.stringify({ answer: "Cita inventada", cited_chunk_ids: [999] }),
  ]
) {
  Deno.test(`strict mode abstains on unverified output: ${text}`, async () => {
    const result = await run({ text });
    assert.equal(result.status, 200);
    assert.equal(result.body.text, ABSTENTION);
    assert.deepEqual(result.body.citations, []);
    const saved = result.calls.find((call) =>
      call.name === "internal_store_tutor_exchange"
    )!;
    assert.equal(saved.args.answer, ABSTENTION);
    assert.deepEqual(saved.args.cited_chunk_ids, []);
  });
}
Deno.test("rejects an undersized input budget before generation and closes the reservation", async () => {
  const result = await run({ budget: 500 });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "INPUT_BUDGET_EXCEEDED");
  assert.equal(result.responsesCalled, 0);
  assert.equal(result.active, false);
});
Deno.test("health fails closed if the limits query fails", async () => {
  const result = await run({ healthFailure: true }, true);
  assert.equal(result.status, 503);
  assert.notEqual(result.body.ready, true);
  assert.equal(result.calls.length, 0);
});
