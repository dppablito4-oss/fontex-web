import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { expressionScene, type Scene } from "../../core/scene/document";
import { useSceneStore } from "./useSceneStore";

const cloud = vi.hoisted(() => ({ rows: new Map<string, { scene: Scene; revision: number }>() }));
vi.mock("../../lib/supabase/client", () => ({ supabase: {
  from: () => ({
    select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [...cloud.rows.values()], error: null }) }) }),
    insert: (row: { scene: Scene; revision: number }) => ({ select: () => ({ single: () => {
      if (cloud.rows.has(row.scene.id)) return Promise.resolve({ data: null, error: { code: "23505" } });
      cloud.rows.set(row.scene.id, structuredClone(row));
      return Promise.resolve({ data: { revision: row.revision }, error: null });
    } }) }),
    update: (change: { scene: Scene; revision: number }) => {
      const filters: Record<string, unknown> = {};
      const query = {
        eq: (key: string, value: unknown) => { filters[key] = value; return query; },
        select: () => ({ maybeSingle: () => {
          const row = cloud.rows.get(String(filters.id));
          if (row?.revision !== filters.revision) return Promise.resolve({ data: null, error: null });
          cloud.rows.set(String(filters.id), structuredClone(change));
          return Promise.resolve({ data: { revision: change.revision }, error: null });
        } }),
      };
      return query;
    },
  }),
} }));

beforeEach(() => { cloud.rows.clear(); localStorage.clear(); });

it("loads the cloud library on a new device without uploading an empty default", async () => {
  const scene = expressionScene("sin(x)"); cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(result.current.scene).toEqual(scene);
  expect(cloud.rows.size).toBe(1);
});

it("saves edits with revisions and refreshes another device's changes", async () => {
  const scene = expressionScene("x^2"); cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  act(() => result.current.setScene(s => ({ ...s, title: "Edited locally" })));
  await waitFor(() => expect(cloud.rows.get(scene.id)?.revision).toBe(2));
  const row = cloud.rows.get(scene.id)!;
  cloud.rows.set(scene.id, { scene: { ...row.scene, title: "Edited remotely" }, revision: 3 });
  await act(async () => { window.dispatchEvent(new Event("focus")); await Promise.resolve(); });
  await waitFor(() => expect(result.current.scene.title).toBe("Edited remotely"));
});

it("preserves both versions after simultaneous device edits", async () => {
  const scene = expressionScene("x^2"); cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  act(() => result.current.setScene(s => ({ ...s, title: "Local work" })));
  cloud.rows.set(scene.id, { scene: { ...scene, title: "Remote work" }, revision: 2 });
  await act(async () => { window.dispatchEvent(new Event("focus")); await Promise.resolve(); });
  await waitFor(() => expect(result.current.scenes).toHaveLength(2));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(result.current.scene.title).toBe("Local work (copia local)");
  expect(cloud.rows.get(scene.id)?.scene.title).toBe("Remote work");
  expect(cloud.rows.size).toBe(2);
});

it("keeps guest scenes local and restores their parameter edits", () => {
  const first = renderHook(() => useSceneStore("guest"));
  act(() => first.result.current.setScene(s => ({ ...s, parameters: { ...s.parameters, a: 3 } })));
  const id = first.result.current.scene.id;
  first.unmount();
  const next = renderHook(() => useSceneStore("guest"));
  expect(next.result.current.scene.id).toBe(id);
  expect(next.result.current.scene.parameters.a).toBe(3);
  expect(cloud.rows.size).toBe(0);
});
