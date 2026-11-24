import {
  type AccountAdminDependencies,
  createAccountAdminHandler,
} from "./handler.ts";
const userId = "accc0000-0000-4000-8000-000000000002",
  requestId = "accc1000-0000-4000-8000-000000000003";
const path = `${userId}/accc2000-0000-4000-8000-000000000001.pdf`;
function assert(value: unknown) {
  if (!value) throw Error("Assertion failed");
}
function setup(extra: Partial<AccountAdminDependencies> = {}) {
  const steps: string[] = [];
  const handler = createAccountAdminHandler({
    prepare: () => {
      steps.push("prepare");
      return Promise.resolve({
        data: { deleted: false, request_id: requestId, paths: [path] },
      });
    },
    remove: (paths) => {
      assert(paths[0] === path);
      steps.push("storage");
      return Promise.resolve({ error: null });
    },
    finish: (user, id) => {
      assert(user === userId && id === requestId);
      steps.push("finish");
      return Promise.resolve({ data: { deleted: true } });
    },
    ...extra,
  });
  const request = (
    body: unknown = {
      userId,
      requestId,
      reason: "Eliminar solo Fontex",
      confirmation: "control-user@example.invalid",
    },
  ) =>
    handler(
      new Request("https://local.invalid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  return { request, steps };
}
Deno.test("deletion removes Storage before deleting Fontex metadata", async () => {
  const s = setup();
  assert((await s.request()).status === 200);
  assert(s.steps.join(",") === "prepare,storage,finish");
});
Deno.test("MFA or permission denial prevents every destructive action", async () => {
  const s = setup({
    prepare: () =>
      Promise.resolve({
        error: { code: "42501", message: "admin_mfa_required" },
      }),
  });
  assert((await s.request()).status === 403);
  assert(s.steps.length === 0);
});
Deno.test("a Storage failure leaves metadata available for a safe retry", async () => {
  const s = setup({
    remove: () => Promise.resolve({ error: { statusCode: 503 } }),
  });
  assert((await s.request()).status === 502);
  assert(!s.steps.includes("finish"));
});
Deno.test("foreign Storage paths are rejected", async () => {
  const s = setup({
    prepare: () =>
      Promise.resolve({
        data: {
          deleted: false,
          request_id: requestId,
          paths: ["other/path.pdf"],
        },
      }),
  });
  assert((await s.request()).status === 500);
  assert(s.steps.length === 0);
});
Deno.test("client-supplied manifests cannot alter the deletion scope", async () => {
  const s = setup();
  assert(
    (await s.request({
      userId,
      requestId,
      reason: "Eliminar",
      confirmation: "x",
      paths: [path],
    })).status === 400,
  );
  assert(s.steps.length === 0);
});
Deno.test("already completed deletion is idempotent", async () => {
  const s = setup({
    prepare: () =>
      Promise.resolve({
        data: { deleted: true, request_id: requestId, paths: [] },
      }),
  });
  assert((await s.request()).status === 200);
  assert(s.steps.length === 0);
});
