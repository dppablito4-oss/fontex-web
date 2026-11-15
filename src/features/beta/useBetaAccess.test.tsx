import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useBetaAccess } from "./useBetaAccess";
const mock = vi.hoisted(() => ({ owner: "member-one", rpc: vi.fn() }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { id: mock.owner } }) }));
vi.mock("../../lib/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));

it("distinguishes a transient refresh error from revocation and a different account", async () => {
  mock.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  const view = renderHook(() => useBetaAccess());
  await waitFor(() => expect(view.result.current.status).toBe("allowed"));
  mock.rpc.mockResolvedValue({ data: null, error: { message: "temporary network failure" } });
  await act(async () => { await view.result.current.refresh(); });
  expect(view.result.current.status).toBe("error");
  expect(view.result.current.lastVerifiedAllowed).toBe(true);
  mock.rpc.mockResolvedValue({ data: { allowed: false }, error: null });
  await act(async () => { await view.result.current.refresh(); });
  expect(view.result.current.status).toBe("denied");
  expect(view.result.current.lastVerifiedAllowed).toBe(false);
  mock.owner = "member-two";
  mock.rpc.mockResolvedValue({ data: null, error: { message: "network failure" } });
  view.rerender();
  expect(view.result.current.lastVerifiedAllowed).toBe(false);
  await waitFor(() => expect(view.result.current.status).toBe("error"));
  expect(view.result.current.lastVerifiedAllowed).toBe(false);
});
