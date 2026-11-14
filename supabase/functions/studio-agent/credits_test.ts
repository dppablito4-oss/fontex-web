import { createPrimitiveHandler as baseHandler } from "./primitive-handler.ts";
import { type CreditAccess, creditAccess } from "./credits.ts";
import {
  createPrimitive,
  newPrimitiveScene,
} from "../../../src/core/primitives/schema.ts";
import { eventData } from "../../../src/core/agent/event-stream.ts";
const createPrimitiveHandler: typeof baseHandler = (env, provider, credits) => baseHandler(env,provider,credits,{reserve:()=>Promise.resolve({allowed:true,reason:"reserved"}),finish:()=>Promise.resolve()});
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw Error(message);
}
const env = (key: string) => key === "OPENAI_API_KEY" ? "test-only" : undefined;
const request = (task: "chat" | "build" = "build") =>
  new Request("https://example.invalid/primitives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scene: newPrimitiveScene(),
      question: "Una explicación breve",
      task,
      level: "primaria",
      selectedId: null,
    }),
  });
const response = (reply: unknown) =>
  Response.json({
    status: "completed",
    output: [{
      content: [{ type: "output_text", text: JSON.stringify(reply) }],
    }],
  });
async function collect(r: Response) {
  assert(r.body);
  const out: unknown[] = [];
  for await (const event of eventData(r.body)) out.push(event);
  return out;
}
Deno.test("credits: exhausted and busy accounts never call the paid provider", async () => {
  for (const reason of ["credits_exhausted", "generation_busy"]) {
    let calls = 0;
    const credits: CreditAccess = {
      reserve: () => Promise.resolve({ allowed: false, balance: 0, reason }),
      finish: () => {
        throw Error("unexpected");
      },
    };
    const r = await createPrimitiveHandler(env, () => {
      calls++;
      throw Error("unexpected");
    }, credits)(request(), { userClaims: { id: "user" } });
    assert(r.status === (reason === "credits_exhausted" ? 402 : 429));
    assert(calls === 0);
  }
});
Deno.test("credits: chat is available with no wallet calls", async () => {
  const credits: CreditAccess = {
    reserve: () => {
      throw Error("Chat must not reserve credits");
    },
    finish: () => {
      throw Error("Chat must not settle credits");
    },
  };
  const events = await collect(
    await createPrimitiveHandler(env, () =>
      Promise.resolve(
        response({ message: "Puedes seguir conversando.", actions: [] }),
      ), credits)(request("chat"), { userClaims: { id: "user" } }),
  );
  assert(
    events.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "result"
    ),
  );
});
Deno.test("credits: a valid proposal settles exactly once before delivery", async () => {
  const calls: boolean[] = [];
  let reservations = 0;
  const credits: CreditAccess = {
    reserve: () => {
      reservations++;
      return Promise.resolve({ allowed: true, balance: 4, reason: "reserved" });
    },
    finish: (_id, success) => {
      calls.push(success);
      return Promise.resolve({ balance: 4, status: "succeeded" });
    },
  };
  const primitive = createPrimitive("math_block", newPrimitiveScene());
  const events = await collect(
    await createPrimitiveHandler(env, () =>
      Promise.resolve(
        response({
          message: "Listo.",
          actions: [{ kind: "add_primitive", primitive }],
        }),
      ), credits)(request(), { userClaims: { id: "user" } }),
  );
  assert(reservations === 1 && calls.length === 1 && calls[0]);
  assert(
    events.some((v) =>
      v && typeof v === "object" && "type" in v && v.type === "result"
    ),
  );
});
Deno.test("credits: provider failures and invalid proposals refund without delivery", async () => {
  for (const invalid of [false, true]) {
    const calls: boolean[] = [];
    const credits: CreditAccess = {
      reserve: () =>
        Promise.resolve({ allowed: true, balance: 4, reason: "reserved" }),
      finish: (_id, success) => {
        calls.push(success);
        return Promise.resolve({ balance: 5, status: "refunded" });
      },
    };
    const orphan = createPrimitive("function_region", newPrimitiveScene());
    const provider: typeof fetch = () =>
      Promise.resolve(
        invalid
          ? response({
            message: "Un cambio inválido.",
            actions: [{ kind: "add_primitive", primitive: orphan }],
          })
          : new Response("unavailable", { status: 503 }),
      );
    const events = await collect(
      await createPrimitiveHandler(env, provider, credits)(request(), {
        userClaims: { id: "user" },
      }),
    );
    assert(calls.length === 1 && calls[0] === false);
    assert(
      !events.some((v) =>
        v && typeof v === "object" && "type" in v && v.type === "result"
      ),
    );
  }
});
Deno.test("credits: RPC adapter rejects malformed or failed accounting responses", async () => {
  for (
    const result of [{ data: null, error: { message: "offline" } }, {
      data: { allowed: true, balance: -1, reason: "reserved" },
      error: null,
    }]
  ) {
    let threw = false;
    try {
      await creditAccess(() => Promise.resolve(result)).reserve(
        "user",
        "request",
      );
    } catch {
      threw = true;
    }
    assert(threw);
  }
});
