import { strict as assert } from "node:assert";
import { sceneHandler } from "./handler.ts";
Deno.test("retired scene agent rejects authenticated calls for every method", async () => {
  for (const method of ["GET", "POST", "PUT", "DELETE"]) {
    const response = await sceneHandler()(
      new Request("http://local", { method }),
      "user",
    );
    assert.equal(response.status, 410);
    assert.equal((await response.json()).code, "scene_agent_retired");
  }
});
Deno.test("retired scene agent does not read a body", async () => {
  const body = new ReadableStream({
    pull() {
      throw Error("must not read");
    },
  });
  assert.equal(
    (await sceneHandler()(
      new Request("http://local", { method: "POST", body }),
      "user",
    )).status,
    410,
  );
  assert.equal((await sceneHandler()(new Request("http://local"))).status, 401);
});
