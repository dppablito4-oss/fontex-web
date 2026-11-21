import { strict as assert } from "node:assert";
import { createPrimitiveHandler } from "./primitive-handler.ts";
import {
  createPrimitive,
  newPrimitiveScene,
} from "../../../src/core/primitives/schema.ts";
import { replySchema } from "../../../src/core/primitives/schema.ts";
import { eventData } from "../../../src/core/agent/event-stream.ts";
const results = (events: unknown[]) =>
  events.filter((e): e is { type: "result"; reply: unknown } =>
    !!e && typeof e === "object" && "type" in e && e.type === "result" &&
    "reply" in e
  );
const env = (name: string) => name === "OPENAI_API_KEY" ? "test" : undefined;
const scene = newPrimitiveScene();
const request = (source = scene) =>
  new Request("http://local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scene: source,
      task: "build",
      question: "Crea un ejercicio completo",
      level: "secundaria",
      selectedId: null,
    }),
  });
const payload = (reply: unknown) =>
  Response.json({
    status: "completed",
    usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
    output: [{
      content: [{ type: "output_text", text: JSON.stringify(reply) }],
    }],
  });
const usage = {
  reserve: () => Promise.resolve({ allowed: true, reason: "reserved" }),
  finish: () => Promise.resolve(),
};
Deno.test("construction exposes the 3D contract and validates linked bodies without calling a real provider",async()=>{
  const source=newPrimitiveScene(),solid=createPrimitive("solid_3d",source);solid.data.solid="sphere";solid.data.radiusExpr="a";
  const handler=createPrimitiveHandler(env,(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    assert.ok(JSON.stringify(body.text.format.schema).includes('"solid_3d"'));
    assert.ok(body.instructions.includes("No sustituyas una esfera por un círculo"));
    return Promise.resolve(payload({message:"Cuerpo creado",variables:[],primitives:[solid]}));
  },{reserve:()=>Promise.resolve({allowed:true,balance:4,reason:"reserved"}),finish:()=>Promise.resolve({balance:4,status:"succeeded"})},usage);
  const response=await handler(request(source),{userClaims:{id:"user"}}),events=[];
  for await(const event of eventData(response.body!))events.push(event);
  const reply=replySchema.parse(results(events)[0]?.reply);
  assert.equal(reply.actions[0]?.kind,"add_primitive");
  assert.ok(JSON.stringify(reply).includes('"sphere"'));
});
Deno.test("empty canvases require a nonempty primitive list in the provider contract", async () => {
  const primitive = createPrimitive("math_block", scene);
  const settlements: boolean[] = [];
  const handler = createPrimitiveHandler(env, (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.text.format.name, "fontex_initial_construction");
    assert.equal(body.text.format.schema.properties.primitives.minItems, 1);
    assert.equal(body.text.format.schema.properties.actions, undefined);
    return Promise.resolve(
      payload({
        message: "Ejercicio creado",
        variables: [],
        primitives: [primitive],
      }),
    );
  }, {
    reserve: () =>
      Promise.resolve({ allowed: true, balance: 4, reason: "reserved" }),
    finish: (_id, success) => {
      settlements.push(success);
      return Promise.resolve({
        balance: 4,
        status: success ? "succeeded" : "refunded",
      });
    },
  }, usage);
  const response = await handler(request(), { userClaims: { id: "user" } });
  const events = [];
  for await (const event of eventData(response.body!)) events.push(event);
  assert.deepEqual(settlements, [true]);
  assert.equal(
    replySchema.parse(results(events)[0]?.reply).actions[0]?.kind,
    "add_primitive",
  );
});
Deno.test("variables-only proposals do not charge or announce a completed empty canvas", async () => {
  const variable = {
    name: "v0",
    value: 4,
    min: 0,
    max: 20,
    step: .5,
    unit: "m/s",
  };
  for (
    const reply of [
      { message: "Listo", variables: [variable], primitives: [] },
      { message: "Listo", actions: [{ kind: "upsert_variable", variable }] },
    ]
  ) {
    const settlements: boolean[] = [];
    const handler = createPrimitiveHandler(
      env,
      () => Promise.resolve(payload(reply)),
      {
        reserve: () =>
          Promise.resolve({ allowed: true, balance: 4, reason: "reserved" }),
        finish: (_id, success) => {
          settlements.push(success);
          return Promise.resolve({ balance: 5, status: "refunded" });
        },
      },
      usage,
    );
    const response = await handler(request(), { userClaims: { id: "user" } });
    const events = [];
    for await (const event of eventData(response.body!)) events.push(event);
    assert.deepEqual(settlements, [false]);
    assert.equal(results(events).length, 0);
  }
});
Deno.test("changing variables on an existing canvas retains the normal patch contract", async () => {
  const source = newPrimitiveScene();
  source.primitives.push(createPrimitive("math_block", source));
  const handler = createPrimitiveHandler(env, (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.text.format.name, "fontex_primitive_patch");
    return Promise.resolve(
      payload({
        message: "Valor actualizado",
        actions: [{
          kind: "upsert_variable",
          variable: {
            name: "v0",
            value: 4,
            min: 0,
            max: 20,
            step: .5,
            unit: "m/s",
          },
        }],
      }),
    );
  }, {
    reserve: () =>
      Promise.resolve({ allowed: true, balance: 4, reason: "reserved" }),
    finish: () => Promise.resolve({ balance: 4, status: "succeeded" }),
  }, usage);
  const response = await handler(request(source), {
    userClaims: { id: "user" },
  });
  const events = [];
  for await (const event of eventData(response.body!)) events.push(event);
  assert.equal(results(events).length, 1);
});
