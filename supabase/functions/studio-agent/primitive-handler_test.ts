import { createPrimitiveHandler as baseHandler } from "./primitive-handler.ts";
import {
  createPrimitive,
  newPrimitiveScene,
} from "../../../src/core/primitives/schema.ts";
import { eventData } from "../../../src/core/agent/event-stream.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw Error(message);
}
const fakeCredits = {
  reserve: () =>
    Promise.resolve({ allowed: true, balance: 4, reason: "reserved" }),
  finish: () => Promise.resolve({ balance: 4, status: "succeeded" as const }),
};
const createPrimitiveHandler: typeof baseHandler = (
  env,
  provider,
  credits = fakeCredits,
) =>
  baseHandler(env, provider, credits, {
    reserve: () => Promise.resolve({ allowed: true, reason: "reserved" }),
    finish: () => Promise.resolve(),
  });
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
Deno.test("build: a variable-only reply cannot charge an empty canvas", async () => {
  const settled: boolean[] = [];
  const credits = {
    reserve: () =>
      Promise.resolve({ allowed: true, balance: 4, reason: "reserved" }),
    finish: (_id: string, success: boolean) => {
      settled.push(success);
      return Promise.resolve({
        balance: success ? 4 : 5,
        status: success ? "succeeded" as const : "refunded" as const,
      });
    },
  };
  const provider: typeof fetch = () =>
    Promise.resolve(Response.json({
      status: "completed",
      output: [{
        content: [{
          type: "output_text",
          text: JSON.stringify({
            message: "He creado una explicación visual.",
            actions: [{
              kind: "upsert_variable",
              variable: {
                name: "a",
                value: 2,
                min: 0,
                max: 10,
                step: 1,
                unit: "",
              },
            }],
          }),
        }],
      }],
    }));
  const result = await events(
    await createPrimitiveHandler(env, provider, credits)(
      request("Crea fracciones", "build"),
      { userClaims: { id: "user" } },
    ),
  );
  assert(
    result.some((value) =>
      value && typeof value === "object" && "type" in value &&
      value.type === "error"
    ),
  );
  assert(
    !result.some((value) =>
      value && typeof value === "object" && "type" in value &&
      value.type === "result"
    ),
  );
  assert(settled.length === 1 && settled[0] === false);
});

Deno.test("build: cancelling the streamed response cancels the provider and refunds its credit", async () => {
  let refunded!: () => void;
  const refund = new Promise<void>((resolve) => {
    refunded = resolve;
  });
  const credits = {
    reserve: () =>
      Promise.resolve({ allowed: true, balance: 4, reason: "reserved" }),
    finish: (_id: string, success: boolean) => {
      assert(!success, "a cancelled provider must not be charged");
      refunded();
      return Promise.resolve({ balance: 5, status: "refunded" as const });
    },
  };
  const provider: typeof fetch = (_url, options) =>
    new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Cancelled", "AbortError")),
        { once: true },
      );
    });
  const response = await createPrimitiveHandler(env, provider, credits)(
    request("Crea fracciones", "build"),
    { userClaims: { id: "user" } },
  );
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  await refund;
  reader.releaseLock();
});
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

Deno.test("primitives: strict provider schema requires nullable optional arcHeight", async () => {
  let found = false;
  const provider: typeof fetch = (_url, options) => {
    const sent = JSON.parse(String(options?.body));
    function walk(value: unknown) {
      if (!value || typeof value !== "object") return;
      const node = value as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      if (node.properties?.arcHeight) {
        found = true;
        assert(node.required?.includes("arcHeight"));
        assert(JSON.stringify(node.properties.arcHeight).includes('"null"'));
      }
      Object.values(value).forEach(walk);
    }
    walk(sent.text.format.schema);
    assert(JSON.stringify(sent.text.format.schema).includes('"equalScale"'));
    return Promise.resolve(Response.json({
      status: "completed",
      output: [{
        content: [{
          type: "output_text",
          text: JSON.stringify({
            message: "Abro el ejemplo.",
            actions: [{ kind: "load_template", templateId: "number-jumps" }],
          }),
        }],
      }],
    }));
  };
  const result = await events(
    await createPrimitiveHandler(env, provider)(
      request("Abre la plantilla number-jumps", "build"),
      { userClaims: { id: "user" } },
    ),
  );
  assert(found);
  assert(
    result.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "result"
    ),
  );
});

Deno.test("beta: validates a generated logic circuit and rejects cyclic proposals atomically", async () => {
  const { templateScene } = await import(
    "../../../src/core/primitives/templates.ts"
  );
  const scene = templateScene("logic-circuit"),
    graph = scene.primitives.find((p) => p.kind === "node_graph")!;
  const actions = [
    ...scene.variables.map((variable) => ({
      kind: "upsert_variable",
      variable,
    })),
    { kind: "add_primitive", primitive: graph },
  ];
  const provider: typeof fetch = () =>
    Promise.resolve(
      Response.json({
        status: "completed",
        output: [{
          content: [{
            type: "output_text",
            text: JSON.stringify({
              message: "Un circuito compartido.",
              actions,
            }),
          }],
        }],
      }),
    );
  const handler = createPrimitiveHandler(env, provider);
  const success = await events(
    await handler(request("Crea un circuito lógico", "build"), {
      userClaims: { id: "user" },
    }),
  );
  assert(
    success.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "result"
    ),
  );
  graph.data.edges.push({ from: "out", to: "both", label: "" });
  const failure = await events(
    await handler(request("Crea un circuito lógico", "build"), {
      userClaims: { id: "user" },
    }),
  );
  assert(
    failure.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "error"
    ),
  );
  assert(
    !failure.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "result"
    ),
  );
});

Deno.test("credits: production build fails closed without a credit service", async () => {
  let called = false;
  const handler = baseHandler(env, () => {
    called = true;
    throw Error("not expected");
  });
  const response = await handler(request("Crea un texto", "build"), {
    userClaims: { id: "user" },
  });
  assert(response.status === 503);
  assert(!called);
});
