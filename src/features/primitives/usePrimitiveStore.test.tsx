import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  newPrimitiveScene as expressionScene,
  type PrimitiveScene as Scene,
} from "../../core/primitives/schema";
import { usePrimitiveStore as useSceneStore } from "./usePrimitiveStore";
import {
  CANVAS_WORKSPACE_FORMAT,
  CANVAS_WORKSPACE_ID,
} from "../../core/scene/formats";

const cloud = vi.hoisted(() => ({
  rows: new Map<string, { scene: Scene; revision: number }>(),
  fullReads: [] as string[][],
  pages: [] as number[],
}));
vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          order: () => query,
          range: (start: number, end: number) => {
            cloud.pages.push(start);
            return Promise.resolve({
              data: [...cloud.rows.values()].filter((row) =>
                row.scene.format === "primitive-scene"
              ).sort((a, b) => a.scene.id.localeCompare(b.scene.id)).slice(
                start,
                end + 1,
              ).map((row) => ({
                id: row.scene.id,
                revision: row.revision,
                scene_title: row.scene.title,
              })),
              error: null,
            });
          },
          in: (_key: string, ids: string[]) => {
            cloud.fullReads.push(ids);
            return Promise.resolve({
              data: ids.flatMap((id) => {
                const row = cloud.rows.get(id);
                return row ? [structuredClone(row)] : [];
              }),
              error: null,
            });
          },
        };
        return query;
      },
      insert: (row: { scene: Scene; revision: number }) => ({
        select: () => ({
          single: () => {
            if (cloud.rows.has(row.scene.id)) {
              return Promise.resolve({ data: null, error: { code: "23505" } });
            }
            cloud.rows.set(row.scene.id, structuredClone(row));
            return Promise.resolve({
              data: { revision: row.revision },
              error: null,
            });
          },
        }),
      }),
      update: (change: { scene: Scene; revision: number }) => {
        const filters: Record<string, unknown> = {};
        const query = {
          eq: (key: string, value: unknown) => {
            filters[key] = value;
            return query;
          },
          select: () => ({
            maybeSingle: () => {
              const row = cloud.rows.get(String(filters.id));
              if (row?.revision !== filters.revision) {
                return Promise.resolve({
                  data: null,
                  error: null,
                });
              }
              cloud.rows.set(String(filters.id), structuredClone(change));
              return Promise.resolve({
                data: { revision: change.revision },
                error: null,
              });
            },
          }),
        };
        return query;
      },
      delete: () => {
        const filters: Record<string, unknown> = {};
        const query = {
          eq: (key: string, value: unknown) => {
            filters[key] = value;
            return query;
          },
          select: () => ({
            maybeSingle: () => {
              const row = cloud.rows.get(String(filters.id));
              if (!row || row.revision !== filters.revision) {
                return Promise.resolve({ data: null, error: null });
              }
              cloud.rows.delete(String(filters.id));
              return Promise.resolve({ data: { id: filters.id }, error: null });
            },
          }),
        };
        return query;
      },
    }),
  },
}));

beforeEach(() => {
  cloud.rows.clear();
  cloud.fullReads.length = 0;
  cloud.pages.length = 0;
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

it("keeps expression scenes independent from the legacy workspace", async () => {
  const scene = expressionScene("sin(x)");
  cloud.rows.set(scene.id, { scene, revision: 1 });
  cloud.rows.set(CANVAS_WORKSPACE_ID, {
    scene: {
      id: CANVAS_WORKSPACE_ID,
      format: CANVAS_WORKSPACE_FORMAT,
    } as unknown as Scene,
    revision: 1,
  });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(result.current.scene).toEqual(scene);
  expect(result.current.notice).toBe("");
  expect(cloud.rows.size).toBe(2);
});

it("loads the cloud library on a new device without uploading an empty default", async () => {
  const scene = expressionScene("sin(x)");
  cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(result.current.scene).toEqual(scene);
  expect(cloud.rows.size).toBe(1);
});

it("saves edits with revisions and refreshes another device's changes", async () => {
  const scene = expressionScene("x^2");
  cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  act(() => {
    result.current.setScene((s) => ({ ...s, title: "Edited locally" }));
  });
  await waitFor(() => expect(cloud.rows.get(scene.id)?.revision).toBe(2));
  const row = cloud.rows.get(scene.id)!;
  cloud.rows.set(scene.id, {
    scene: { ...row.scene, title: "Edited remotely" },
    revision: 3,
  });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(result.current.scene.title).toBe("Edited remotely")
  );
});

it("preserves both versions after simultaneous device edits", async () => {
  const scene = expressionScene("x^2");
  cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  act(() => {
    result.current.setScene((s) => ({ ...s, title: "Local work" }));
  });
  cloud.rows.set(scene.id, {
    scene: { ...scene, title: "Remote work" },
    revision: 2,
  });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.scenes).toHaveLength(2));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(result.current.scene.title).toBe("Local work (copia local)");
  expect(cloud.rows.get(scene.id)?.scene.title).toBe("Remote work");
  expect(cloud.rows.size).toBe(2);
});

it("restores guest primitive scenes with their shared variables", () => {
  const first = renderHook(() => useSceneStore("guest"));
  act(() => {
    first.result.current.setScene((s) => ({
      ...s,
      variables: s.variables.map((v) => ({ ...v, value: 3 })),
    }));
  });
  const id = first.result.current.scene.id;
  first.unmount();
  const next = renderHook(() => useSceneStore("guest"));
  expect(next.result.current.scene.id).toBe(id);
  expect(next.result.current.scene.variables[0]?.value).toBe(3);
  expect(cloud.rows.size).toBe(0);
});

it("paginates metadata and downloads only opened or changed content", async () => {
  for (let i = 0; i < 30; i++) {
    const scene = {
      ...expressionScene(),
      id: `scene-${String(i).padStart(2, "0")}`,
    };
    cloud.rows.set(scene.id, { scene, revision: 1 });
  }
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(result.current.scenes).toHaveLength(30);
  expect(cloud.pages).toEqual([0, 25]);
  expect(cloud.fullReads.flat()).toEqual(["scene-00"]);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(cloud.fullReads.flat()).toEqual(["scene-00"]);
  act(() => result.current.open("scene-29"));
  await waitFor(() => expect(result.current.scene.id).toBe("scene-29"));
  expect(cloud.fullReads.flat()).toEqual(["scene-00", "scene-29"]);
});

it("removes a saved scene without resurrecting it on another refresh", async () => {
  const scene = expressionScene();
  cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  let removed = false;
  await act(async () => {
    removed = await result.current.remove(scene.id);
  });
  expect(removed).toBe(true);
  expect(cloud.rows.has(scene.id)).toBe(false);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(result.current.scene.id).not.toBe(scene.id);
  expect(cloud.rows.has(scene.id)).toBe(false);
});

it("honors a remote deletion and preserves unsaved work as a different scene", async () => {
  const scene = expressionScene();
  cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  act(() => {
    result.current.setScene((s) => ({ ...s, title: "Unsaved work" }));
  });
  cloud.rows.delete(scene.id);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(result.current.scene.title).toBe("Unsaved work (copia local)");
  expect(result.current.scene.id).not.toBe(scene.id);
  expect(cloud.rows.has(scene.id)).toBe(false);
});

it("does not resurrect a cloud deletion when browser storage becomes read-only", async () => {
  const scene = expressionScene();
  cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("quota");
  });
  await act(async () => {
    expect(await result.current.remove(scene.id)).toBe(true);
  });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(cloud.rows.has(scene.id)).toBe(false);
  expect(result.current.scene.id).not.toBe(scene.id);
});

it("frees a quota slot when other scenes exist only in the remote catalog",async()=>{
  for(let i=0;i<30;i++){const scene={...expressionScene(),id:`scene-${String(i).padStart(2,"0")}`};cloud.rows.set(scene.id,{scene,revision:1});}
  const {result}=renderHook(()=>useSceneStore("account"));
  await waitFor(()=>expect(result.current.status).toBe("saved"));
  await act(async()=>{expect(await result.current.remove("scene-00")).toBe(true);});
  expect(result.current.scene.id).toBe("scene-01");
  await act(async()=>{window.dispatchEvent(new Event("focus"));await Promise.resolve();});
  await waitFor(()=>expect(result.current.status).toBe("saved"));
  expect(cloud.rows.size).toBe(29);
  expect(result.current.scenes).toHaveLength(29);
});

it("closes saved tabs without deleting their JSON and reopens them from the catalog", async () => {
  const scene = expressionScene("Fracciones");
  cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  await act(async () => { expect(await result.current.close(scene.id, false)).toBe(true); });
  expect(result.current.tabs.some(s => s.id === scene.id)).toBe(false);
  expect(result.current.scenes.some(s => s.id === scene.id)).toBe(true);
  expect(cloud.rows.has(scene.id)).toBe(true);
  act(() => result.current.open(scene.id));
  expect(result.current.scene.title).toBe("Fracciones");
  expect(result.current.tabs.some(s => s.id === scene.id)).toBe(true);
});

it("discards edits to the opened version while preserving the saved document", async () => {
  const scene = expressionScene("Original");
  cloud.rows.set(scene.id, { scene, revision: 1 });
  const { result } = renderHook(() => useSceneStore("account"));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  act(() => { result.current.setScene(s => ({ ...s, title: "Cambios descartables" })); });
  await act(async () => { expect(await result.current.close(scene.id, true)).toBe(true); });
  await waitFor(() => expect(cloud.rows.get(scene.id)?.scene.title).toBe("Original"));
  act(() => result.current.open(scene.id));
  expect(result.current.scene.title).toBe("Original");
});
