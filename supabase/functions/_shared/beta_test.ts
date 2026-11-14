import { strict as assert } from "node:assert";
import { betaDenial, requestAccess } from "./beta.ts";
Deno.test("beta checks fail closed and the AI pause does not hide non-AI services", async () => {
  const rpc = (data: unknown, error: unknown = null) => () =>
    Promise.resolve({ data, error });
  assert.equal((await betaDenial(undefined, rpc(null)))?.status, 401);
  assert.equal(
    (await betaDenial("user", rpc({ allowed: false, ai_enabled: true })))
      ?.status,
    403,
  );
  assert.equal((await betaDenial("user", rpc(null)))?.status, 503);
  assert.equal(
    (await betaDenial("user", rpc({ allowed: true, ai_enabled: false }), true))
      ?.status,
    503,
  );
  assert.equal(
    await betaDenial("user", rpc({ allowed: true, ai_enabled: false })),
    null,
  );
});
Deno.test("request accounting validates responses and retries idempotent completion", async () => {
  await assert.rejects(() =>
    requestAccess(() => Promise.resolve({ data: { allowed: 1 }, error: null }))
      .reserve("u", "id", "chat", 10)
  );
  let calls = 0;
  await requestAccess(() =>
    Promise.resolve({ data: null, error: ++calls === 1 ? {} : null })
  ).finish("id");
  assert.equal(calls, 2);
});
