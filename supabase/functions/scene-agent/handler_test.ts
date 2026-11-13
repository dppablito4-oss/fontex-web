import { strict as assert } from "node:assert";
import { sceneHandler } from "./handler.ts";
import { expressionScene } from "../../../src/core/scene/document.ts";
Deno.test("scene: exige sesión y valida entrada antes del proveedor", async () => {
  let calls = 0;
  const h = sceneHandler(() => "key", () => {
    calls++;
    throw Error();
  });
  assert.equal(
    (await h(new Request("http://local", { method: "POST", body: "{}" })))
      .status,
    401,
  );
  assert.equal(
    (await h(
      new Request("http://local", { method: "POST", body: "{}" }),
      "user",
    )).status,
    400,
  );
  assert.equal(calls, 0);
});
Deno.test("scene: valida referencias y expresiones; no ejecuta código generado", async () => {
  for (const source of ["x^4-5*x^2+4=0", "alert(x)"]) {
    const scene = expressionScene("sin(x)");
    scene.expressions[0]!.source = source;
    const h = sceneHandler(
      () => "key",
      () =>
        Promise.resolve(
          Response.json({
            status: "completed",
            output: [{
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(scene) }],
            }],
          }),
        ),
    );
    const r = await h(
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({ question: "Crea una función" }),
      }),
      "user",
    );
    assert.equal(r.status, source.startsWith("alert") ? 422 : 200);
  }
});
