import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useWorkspace, WorkspaceProvider } from "./WorkspaceProvider";

const remote = vi.hoisted(() => ({
  deferB: false,
  pendingB: [] as Array<() => void>,
}));
vi.mock(
  "../auth/AuthProvider",
  () => ({ useAuth: () => ({ status: "authenticated", user: { id: "u" } }) }),
);
vi.mock(
  "../../lib/supabase/client",
  () => ({
    supabase: {
      from: (table: string) => ({
        select: () => {
          let classroom = "";
          const query = {
            eq: (key: string, value: string) => {
              if (key === "classroom_id") classroom = value;
              return query;
            },
            order: () =>
              Promise.resolve({
                data: table === "classrooms"
                  ? ["A", "B"].map((id) => ({
                    id,
                    organization_id: id,
                    title: id,
                    term: null,
                    owner_id: "u",
                  }))
                  : [],
                error: null,
              }),
            in: (_key: string, ids: string[]) =>
              Promise.resolve({
                data: ids.map((id) => ({ id, display_name: id })),
                error: null,
              }),
            then: (resolve: (value: unknown) => unknown) => {
              const value = {
                data: [{
                  user_id: classroom,
                  role: "student",
                  status: "active",
                }],
                error: null,
              };
              return classroom === "B" && remote.deferB
                ? new Promise((done) => remote.pendingB.push(() => done(value)))
                  .then(resolve)
                : Promise.resolve(value).then(resolve);
            },
          };
          return query;
        },
      }),
    },
  }),
);

it("discards slow classroom details after the user selects another classroom", async () => {
  const { result } = renderHook(() => useWorkspace(), {
    wrapper: WorkspaceProvider,
  });
  await waitFor(() => expect(result.current.members[0]?.userId).toBe("A"));
  remote.deferB = true;
  act(() => result.current.selectClassroom("B"));
  expect(result.current.members).toEqual([]);
  await waitFor(() => expect(remote.pendingB.length).toBeGreaterThan(0));
  act(() => result.current.selectClassroom("A"));
  await waitFor(() => expect(result.current.members[0]?.userId).toBe("A"));
  await act(async () => {
    for (const resolve of remote.pendingB.splice(0)) resolve();
    await Promise.resolve();
  });
  expect(result.current.activeClassroom?.id).toBe("A");
  expect(result.current.members[0]?.userId).toBe("A");
});
