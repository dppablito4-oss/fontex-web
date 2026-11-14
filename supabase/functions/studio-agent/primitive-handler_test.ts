import { createPrimitiveHandler } from "./primitive-handler.ts";
import {
  createPrimitive,
  newPrimitiveScene,
} from "../../../src/core/primitives/schema.ts";
import { eventData } from "../../../src/core/agent/event-stream.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw Error(message);
}
const request = (
  question = "Explica una función",
  task: "chat" | "build" = "chat",
) =>
  new Request("https://example.invalid/studio-agent/primitives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scene: newPrimitiveScene(),
      question,
      task,
      level: "secundaria",
      selectedId: null,
    }),
  });
const env = (key: string) => key === "OPENAI_API_KEY" ? "test-only" : undefined;
async function events(response: Response) {
  assert(response.body);
  const out: unknown[] = [];
  for await (const e of eventData(response.body)) out.push(e);
  return out;
}
Deno.test("primitives: authenticate and validate before calling provider", async () => {
  let calls = 0;
  const handler = createPrimitiveHandler(env, () => {
    calls++;
    throw Error("unexpected");
  });
  assert((await handler(request(), {})).status === 401);
  assert(
    (await handler(
      new Request("https://example.invalid", {
        method: "POST",
        body: '{"scene":{}}',
        headers: { "Content-Type": "application/json" },
      }),
      { userClaims: { id: "user" } },
    )).status === 400,
  );
  assert(calls === 0);
});
Deno.test("primitives: stream safe text then validate a complete atomic patch", async () => {
  const scene = newPrimitiveScene(),
    primitive = createPrimitive("math_block", scene);
  let model = "";
  const provider: typeof fetch = (_url, options) => {
    const sent = JSON.parse(String(options?.body));
    model = sent.model;
    const contract = JSON.stringify(sent.text.format.schema);
    assert(
      !contract.includes('"oneOf"'),
      "provider schema must use anyOf, not oneOf",
    );
    assert(
      !contract.includes('"additionalItems"'),
      "provider schema must normalize tuples",
    );
    const reply = {
      message: "Una explicación vinculada al lienzo.",
      actions: [{ kind: "add_primitive", primitive }],
    };
    return Promise.resolve(Response.json({
      status: "completed",
      output: [{
        content: [{ type: "output_text", text: JSON.stringify(reply) }],
      }],
    }));
  };
  const handler = createPrimitiveHandler(env, provider);
  const result = await events(
    await handler(request("Crea una explicación", "build"), {
      userClaims: { id: "user" },
    }),
  );
  assert(
    result.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "result"
    ),
  );
  assert(model === "gpt-6.1-sol");
});
Deno.test("primitives: chat cannot perform hidden edits", async () => {
  const primitive = createPrimitive("math_block", newPrimitiveScene());
  const provider: typeof fetch = () =>
    Promise.resolve(Response.json({
      status: "completed",
      output: [{
        content: [{
          type: "output_text",
          text: JSON.stringify({
            message: "Listo",
            actions: [{ kind: "add_primitive", primitive }],
          }),
        }],
      }],
    }));
  const result = await events(
    await createPrimitiveHandler(env, provider)(request(), {
      userClaims: { id: "user" },
    }),
  );
  assert(
    result.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "error"
    ),
  );
  assert(
    !result.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "result"
    ),
  );
});
Deno.test("primitives: broken parent references never reach the client as success", async () => {
  const primitive = createPrimitive("function_region", newPrimitiveScene());
  const provider: typeof fetch = () =>
    Promise.resolve(Response.json({
      status: "completed",
      output: [{
        content: [{
          type: "output_text",
          text: JSON.stringify({
            message: "Creado",
            actions: [{ kind: "add_primitive", primitive }],
          }),
        }],
      }],
    }));
  const result = await events(
    await createPrimitiveHandler(env, provider)(
      request("Crea una función", "build"),
      { userClaims: { id: "user" } },
    ),
  );
  assert(
    result.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "error"
    ),
  );
});
Deno.test("primitives: forwards streaming deltas without exposing raw actions", async () => {
  const reply = { message: "Hola, exploremos una idea.", actions: [] };
  const encoded = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (
        const data of [{
          type: "response.output_text.delta",
          delta: '{"message":"Hola',
        }, {
          type: "response.output_text.delta",
          delta: ', exploremos una idea.","actions":[]}',
        }, {
          type: "response.completed",
          response: {
            status: "completed",
            output: [{
              content: [{ type: "output_text", text: JSON.stringify(reply) }],
            }],
          },
        }]
      ) c.enqueue(encoded.encode(`data: ${JSON.stringify(data)}\n\n`));
      c.close();
    },
  });
  const provider: typeof fetch = () =>
    Promise.resolve(
      new Response(stream, {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
  const result = await events(
    await createPrimitiveHandler(env, provider)(request(), {
      userClaims: { id: "user" },
    }),
  );
  assert(
    result.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "text" &&
      "text" in v && v.text === "Hola"
    ),
  );
  assert(
    result.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "result"
    ),
  );
});
