import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { createDocument } from "../../core/object-registry/registry";
import { CANVAS_WORKSPACE_ID } from "../../core/scene/formats";
import { useStudioCloud } from "./useStudioCloud";
import { lastMaterial } from "./native-document-store";
import { readWorkspace, workspaceScene, workspaceEvent, writeWorkspace, type Workspace } from "./workspace-sync";

type Row = { scene: ReturnType<typeof workspaceScene>; revision: number };
const cloud = vi.hoisted(() => ({ row: null as Row | null, tables: [] as string[], writes: [] as Row[] }));
vi.mock("../../lib/supabase/client", () => ({ supabase: { from: (table: string) => {
  cloud.tables.push(table);
  return {
    select: () => {
      const filters: Record<string, unknown> = {};
      const query = { eq: (key: string, value: unknown) => { filters[key] = value; return query; }, maybeSingle: () => {
        expect(filters.id).toBe("canvas-workspace-v1");
        return Promise.resolve({ data: structuredClone(cloud.row), error: null });
      } };
      return query;
    },
    insert: (payload: Row & { id: string }) => ({ select: () => ({ single: () => {
      expect(payload.id).toBe("canvas-workspace-v1");
      if (cloud.row) return Promise.resolve({ data: null, error: { code: "23505" } });
      cloud.row = structuredClone(payload); cloud.writes.push(cloud.row);
      return Promise.resolve({ data: { revision: payload.revision }, error: null });
    } }) }),
    update: (payload: Row) => {
      const filters: Record<string, unknown> = {};
      const query = { eq: (key: string, value: unknown) => { filters[key] = value; return query; }, select: () => ({ maybeSingle: () => {
        expect(filters.id).toBe("canvas-workspace-v1");
        if (cloud.row?.revision !== filters.revision) return Promise.resolve({ data: null, error: null });
        cloud.row = structuredClone(payload); cloud.writes.push(cloud.row);
        return Promise.resolve({ data: { revision: payload.revision }, error: null });
      } }) };
      return query;
    },
  };
} } }));

const workspace = (): Workspace => { const doc = createDocument("sequences"); return { activeId: doc.id, documents: [doc], conversations: { [doc.id]: [{ role: "user", content: "Explica este patrón" }] } }; };
beforeEach(() => { localStorage.clear(); cloud.row = null; cloud.tables = []; cloud.writes = []; });

it("hydrates the free canvas and lateral chat from the current SQL scene table", async () => {
  const state = workspace();
  cloud.row = { scene: workspaceScene(state), revision: 1 };
  const hydrate = vi.fn();
  const { result } = renderHook(() => useStudioCloud("account", hydrate));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(lastMaterial(localStorage, "account")).toEqual(state.documents[0]);
  expect(result.current.conversations).toEqual(state.conversations);
  expect(hydrate).toHaveBeenCalled();
  expect(new Set(cloud.tables)).toEqual(new Set(["visual_scenes"]));
  expect(localStorage.getItem("fontex-studio-v2:account")).toBeNull();
});

it("saves new free-canvas materials and their chat without accessing the retired table", async () => {
  const state = workspace(); writeWorkspace("account", state);
  const { result } = renderHook(() => useStudioCloud("account", () => {}));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(cloud.row?.scene.id).toBe(CANVAS_WORKSPACE_ID);
  expect(cloud.row?.scene.state).toEqual(state);
  act(() => result.current.setConversation(state.activeId!, [{ role: "assistant", content: "Observa la diferencia constante." }], true));
  await waitFor(() => expect(cloud.row?.revision).toBe(2));
  expect(cloud.row?.scene.state.conversations[state.activeId!]?.[0]?.content).toBe("Observa la diferencia constante.");
  expect(new Set(cloud.tables)).toEqual(new Set(["visual_scenes"]));
});

it("preserves both documents after concurrent device edits", async () => {
  const state = workspace(); cloud.row = { scene: workspaceScene(state), revision: 1 };
  const { result } = renderHook(() => useStudioCloud("account", () => {}));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  const local = readWorkspace("account"); local.documents[0]!.title = "Cambio local"; writeWorkspace("account", local);
  const remote = structuredClone(state); remote.documents[0]!.title = "Cambio remoto";
  cloud.row = { scene: workspaceScene(remote), revision: 2 };
  act(() => { window.dispatchEvent(new CustomEvent(workspaceEvent, { detail: "account" })); window.dispatchEvent(new Event("focus")); });
  await waitFor(() => expect(cloud.row?.revision).toBe(3));
  expect(cloud.row?.scene.state.documents.map(doc => doc.title)).toEqual(expect.arrayContaining(["Cambio remoto", "Cambio local (copia local)"]));
});
