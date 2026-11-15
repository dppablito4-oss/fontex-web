import { type SetStateAction, useEffect, useRef, useState } from "react";
import {
  newPrimitiveScene,
  parsePrimitiveScene,
  type PrimitiveScene,
} from "../../core/primitives/schema";
import { isPrimitiveScene } from "../../core/scene/formats";
import { supabase } from "../../lib/supabase/client";
import type { Json } from "../../lib/supabase/database.types";
type Collection = {
  activeId: string;
  scenes: PrimitiveScene[];
  fresh?: boolean;
};
type Ack = Record<string, { revision: number; hash: string }>;
const cacheKey = (owner: string) => `fontex-primitives-v2:${owner}`;
function initial(owner: string): Collection {
  // These caches belonged to the retired test editor. Auth and current scenes are untouched.
  try {
    for (const key of Object.keys(localStorage)) {
      if (
        /^fontex-(?:canvas-(?:v1|chat-v1|sync-v1)|scenes-v1|studio-(?:v1|v2|chat-v1|sync-v1)|general-prototype):/
          .test(key)
      ) localStorage.removeItem(key);
    }
  } catch { /* Read-only browser storage. */ }
  const scenes: PrimitiveScene[] = [];
  let activeId = "";
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey(owner)) ?? "null") as
      | Collection
      | null;
    if (raw && Array.isArray(raw.scenes)) {
      for (const value of raw.scenes) {
        try {
          const scene = parsePrimitiveScene(value);
          if (!scenes.some((s) => s.id === scene.id)) scenes.push(scene);
        } catch { /* One invalid record does not hide valid scenes. */ }
      }
      activeId = raw.activeId;
    }
  } catch { /* Cloud recovery remains available. */ }
  const fresh = !scenes.length;
  if (fresh) scenes.push(newPrimitiveScene());
  return {
    scenes,
    fresh,
    activeId: scenes.some((s) => s.id === activeId) ? activeId : scenes[0]!.id,
  };
}
const fingerprints = new WeakMap<PrimitiveScene, Promise<string>>();
function hash(scene: PrimitiveScene) {
  const cached = fingerprints.get(scene);
  if (cached) return cached;
  const pending = computeHash(scene);
  fingerprints.set(scene, pending);
  return pending;
}
async function computeHash(scene: PrimitiveScene) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(scene)),
  );
  return Array.from(
    new Uint8Array(bytes),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
export function usePrimitiveStore(owner: string) {
  const [collection, setCollection] = useState(() => initial(owner));
  // A restored document is already saved, even when it contains only chat.
  const checkpoints = useRef(new Map<string, PrimitiveScene | null>(collection.scenes.map(s => [s.id, collection.fresh ? null : s])));
  const [closedIds, setClosedIds] = useState<string[]>(() => {
    try { const ids: unknown = JSON.parse(localStorage.getItem(cacheKey(owner) + ":closed") ?? "[]"); return Array.isArray(ids) ? ids.filter((id: unknown): id is string => typeof id === "string") : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(cacheKey(owner) + ":closed", JSON.stringify(closedIds)); } catch { /* Optional tab preference. */ } }, [closedIds, owner]);
  const saveAction = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const [catalog, setCatalog] = useState<{ id: string; title: string }[]>([]);
  const catalogRef = useRef<{ id: string; title: string }[]>([]);
  const requestedId = useRef<string | null>(null), deleting = useRef(false);
  const removeAction = useRef<(id: string) => Promise<boolean>>(() =>
    Promise.resolve(false)
  );
  const persistAction = useRef<() => boolean>(() => true);
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const current = useRef(collection),
    version = useRef(0),
    wake = useRef<() => void>(() => {});
  const [status, setStatus] = useState(owner === "guest" ? "local" : "loading"),
    [notice, setNotice] = useState("");
  function store(next: Collection) {
    current.current = next;
    setCollection(next);
    clearTimeout(cacheTimer.current);
    cacheTimer.current = setTimeout(() => persistAction.current(), 180);
  }
  useEffect(() => {
    const persist = () => {
      try {
        localStorage.setItem(cacheKey(owner), JSON.stringify(current.current));
        if (owner === "guest") setStatus("local");
        return true;
      } catch {
        if (owner === "guest") setStatus("error");
        setNotice(
          "No se pudo guardar la copia local. Exporta tu trabajo antes de cerrar esta pestaña.",
        );
        return false;
      }
    };
    persistAction.current = persist;
    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(cacheTimer.current);
      persist();
      window.removeEventListener("pagehide", persist);
    };
  }, [owner]);

  function setScene(change: SetStateAction<PrimitiveScene>) {
    if (deleting.current) {
      setNotice("Espera a que termine la eliminación del lienzo.");
      return false;
    }
    const old = current.current.scenes.find((s) =>
      s.id === current.current.activeId
    )!;
    const updated = typeof change === "function" ? change(old) : change;
    let scene: PrimitiveScene;
    try {
      scene = parsePrimitiveScene({
        ...updated,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "La escena no es válida.",
      );
      return false;
    }
    if (
      !current.current.scenes.some((s) => s.id === scene.id) &&
      new Set([
          ...catalog.map((s) => s.id),
          ...current.current.scenes.map((s) => s.id),
        ]).size >= 100
    ) {
      setNotice(
        "Tu biblioteca admite hasta 100 lienzos. Elimina uno o guarda una copia JSON antes de crear otro.",
      );
      return false;
    }
    if (!checkpoints.current.has(scene.id)) checkpoints.current.set(scene.id, null);
    setClosedIds(ids => ids.filter(id => id !== scene.id));
    version.current++;
    if (owner === "guest") setStatus("saving");
    store({
      activeId: scene.id,
      scenes: [
        ...current.current.scenes.filter((s) => s.id !== scene.id),
        scene,
      ],
    });
    wake.current();
    return true;
  }
  function open(id: string) {
    const opening = current.current.scenes.find(s => s.id === id);
    if (closedIds.includes(id) && opening) checkpoints.current.set(id, opening);
    setClosedIds(ids => ids.filter(value => value !== id));
    if (deleting.current) return;
    requestedId.current = null;
    if (current.current.scenes.some((s) => s.id === id)) {
      version.current++;
      store({ ...current.current, activeId: id });
    } else if (catalog.some((s) => s.id === id)) {
      requestedId.current = id;
      version.current++;
      wake.current();
    }
  }
  async function remove(id: string) {
    if (owner !== "guest") return removeAction.current(id);
    const scenes = current.current.scenes.filter((s) => s.id !== id);
    if (!scenes.length) scenes.push(newPrimitiveScene());
    version.current++;
    store({
      scenes,
      activeId: scenes.some((s) => s.id === current.current.activeId)
        ? current.current.activeId
        : scenes[0]!.id,
    });
    return true;
  }
  useEffect(() => {
    if (owner === "guest" || !supabase) return;
    const client = supabase, ackKey = `${cacheKey(owner)}:ack`;
    let ack: Ack = {};
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(ackKey) ?? "{}");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
          if (
            value && typeof value === "object" && "revision" in value &&
            Number.isSafeInteger(value.revision) &&
            Number(value.revision) > 0 && "hash" in value &&
            typeof value.hash === "string" && /^[a-f0-9]{64}$/.test(value.hash)
          ) {
            ack[id] = { revision: Number(value.revision), hash: value.hash };
          }
        }
      }
    } catch { /* Reconcile conservatively. */ }
    function persistAck() {
      try {
        localStorage.setItem(ackKey, JSON.stringify(ack));
      } catch {
        if (alive) {
          setNotice(
            "El guardado en tu cuenta continúa, pero no se pudo actualizar la copia local. Exporta un JSON si necesitas trabajar sin conexión.",
          );
        }
      }
    }
    let alive = true,
      lastSyncFailed = false,
      running = false,
      queued = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    async function sync() {
      if (deleting.current) return;
      queued = true;
      if (running) return;
      running = true;
      lastSyncFailed = false;
      try {
        let attempts = 0;
        while (queued && alive && attempts++ < 4) {
          queued = false;
          if (!navigator.onLine) {
            setStatus("offline");
            break;
          }
          setStatus("saving");
          const metadata: {
            id: string;
            revision: number;
            scene_title: string | null;
          }[] = [];
          for (let offset = 0;; offset += 25) {
            const page = await client.from("visual_scenes").select(
              "id,revision,scene_title",
            ).eq("user_id", owner).eq("scene->>format", "primitive-scene")
              .order("id").range(offset, offset + 24);
            if (!alive) return;
            if (page.error) throw page.error;
            metadata.push(...page.data);
            if (page.data.length < 25) break;
          }
          const snapshotVersion = version.current;
          const target = requestedId.current ??
            (current.current.fresh && snapshotVersion === 0
              ? metadata[0]?.id
              : undefined);
          const need = metadata.filter((m) => {
            const local = current.current.scenes.find((s) => s.id === m.id);
            return local ? ack[m.id]?.revision !== m.revision : m.id === target;
          }).map((m) => m.id);
          const fetched: { scene: Json; revision: number }[] = [];
          for (let offset = 0; offset < need.length; offset += 25) {
            const rows = await client.from("visual_scenes").select(
              "scene,revision",
            ).eq("user_id", owner).in("id", need.slice(offset, offset + 25));
            if (!alive) return;
            if (rows.error) throw rows.error;
            fetched.push(...rows.data);
          }
          const result = { data: fetched };
          const fetchedIds = new Set(
            fetched.flatMap((row) =>
              row.scene && typeof row.scene === "object" &&
                !Array.isArray(row.scene) && typeof row.scene.id === "string"
                ? [row.scene.id]
                : []
            ),
          );
          if (need.some((id) => !fetchedIds.has(id))) {
            queued = true;
            continue;
          }
          const reused = new Map<string, PrimitiveScene>();
          for (const m of metadata) {
            const local = current.current.scenes.find((s) => s.id === m.id);
            if (local && ack[m.id]?.revision === m.revision) {
              reused.set(m.id, local);
              result.data.push({
                scene: local,
                revision: m.revision,
              });
            }
          }
          const nextAck = { ...ack };
          const nextCheckpoints = new Map(checkpoints.current);
          let scenes = [...current.current.scenes],
            activeId = current.current.activeId,
            copied = false;
          const remote = new Map<
            string,
            { scene: PrimitiveScene; revision: number; hash: string }
          >();
          for (const row of result.data) {
            if (!isPrimitiveScene(row.scene)) continue;
            try {
              const rawId = (row.scene as { id: string }).id;
              const scene = reused.get(rawId) ?? parsePrimitiveScene(row.scene);
              remote.set(scene.id, {
                scene,
                revision: row.revision,
                hash: reused.has(scene.id)
                  ? ack[scene.id]!.hash
                  : await hash(scene),
              });
            } catch {
              setNotice(
                "Una escena remota no es válida. Las demás siguen disponibles.",
              );
            }
          }
          if (remote.size && current.current.fresh && snapshotVersion === 0) {
            scenes = [];
            activeId = remote.keys().next().value ?? activeId;
          }
          const remoteIds = new Set(metadata.map((m) => m.id));
          for (const local of [...scenes]) {
            if (!ack[local.id] || remoteIds.has(local.id)) continue;
            scenes = scenes.filter((s) => s.id !== local.id);
            if (await hash(local) !== ack[local.id]!.hash) {
              const copy = {
                ...local,
                id: crypto.randomUUID(),
                title: `${local.title.slice(0, 100)} (copia local)`,
              };
              scenes.push(copy);
              nextCheckpoints.set(copy.id, copy);
              if (activeId === local.id) activeId = copy.id;
              copied = true;
            }
            delete nextAck[local.id];
            nextCheckpoints.delete(local.id);
          }
          for (const [id, row] of remote) {
            const local = scenes.find((s) => s.id === id);
            if (!local) {
              scenes.push(row.scene);
              nextCheckpoints.set(id, row.scene);
              nextAck[id] = { revision: row.revision, hash: row.hash };
              continue;
            }
            const localHash = await hash(local), base = ack[id];
            if (localHash === row.hash) {
              // A real remote read becomes the new discard baseline. Reusing a
              // local autosave must preserve the opened/manually saved version.
              if (!reused.has(id)) nextCheckpoints.set(id, row.scene);
              nextAck[id] = { revision: row.revision, hash: row.hash };
              continue;
            }
            if (base?.revision === row.revision) continue;
            if (base?.hash !== localHash) {
              const copy = {
                ...local,
                id: crypto.randomUUID(),
                title: `${local.title.slice(0, 100)} (copia local)`,
              };
              scenes.push(copy);
              nextCheckpoints.set(copy.id, copy);
              if (activeId === id) activeId = copy.id;
              copied = true;
            }
            scenes = scenes.map((s) => s.id === id ? row.scene : s);
            nextCheckpoints.set(id, row.scene);
            nextAck[id] = { revision: row.revision, hash: row.hash };
          }
          if (!alive) return;
          if (snapshotVersion !== version.current) {
            queued = true;
            continue;
          }
          if (target && scenes.some((s) => s.id === target)) {
            activeId = target;
            requestedId.current = null;
          }
          if (!scenes.length) scenes.push(newPrimitiveScene());
          if (!scenes.some((s) => s.id === activeId)) activeId = scenes[0]!.id;
          catalogRef.current = metadata.map((m) => ({
              id: m.id,
              title: m.scene_title ?? "Sin título",
            }));
          setCatalog(catalogRef.current);
          // A discarded merge must not advance the base used by the next attempt.
          ack = nextAck;
          checkpoints.current = nextCheckpoints;
          const merged = { activeId, scenes };
          current.current = merged;
          setCollection(merged);
          try {
            localStorage.setItem(cacheKey(owner), JSON.stringify(merged));
          } catch { /* A cloud save can still succeed. */ }
          if (copied) {
            setNotice(
              "Conservamos una copia local porque había cambios en otro dispositivo.",
            );
          }
          for (const scene of scenes) {
            const fingerprint = await hash(scene), row = remote.get(scene.id);
            if (fingerprint === row?.hash) continue;
            const revision = row?.revision ?? 0;
            const saved = revision === 0
              ? await client.from("visual_scenes").insert({
                user_id: owner,
                id: scene.id,
                scene: scene as unknown as Json,
                revision: 1,
              }).select("revision").single()
              : await client.from("visual_scenes").update({
                scene: scene,
                revision: revision + 1,
              }).eq("user_id", owner).eq("id", scene.id).eq(
                "revision",
                revision,
              ).select("revision").maybeSingle();
            if (!alive) return;
            if (saved.error?.code === "23505") {
              queued = true;
              break;
            }
            if (saved.error) throw saved.error;
            if (!saved.data) {
              queued = true;
              break;
            }
            ack[scene.id] = {
              revision: saved.data.revision,
              hash: fingerprint,
            };
          }
          persistAck();
          if (snapshotVersion !== version.current) queued = true;
          if (alive) setStatus(queued ? "saving" : "saved");
        }
      } catch (error) {
        lastSyncFailed = true;
        if (alive) {
          setStatus(navigator.onLine ? "error" : "offline");
          setNotice(
            error && typeof error === "object" && "code" in error &&
              error.code === "54000"
              ? "Tu biblioteca alcanzó su cuota (100 lienzos / 20 MiB). Exporta tu trabajo y elimina un lienzo antes de reintentar."
              : "La sincronización está pendiente. Conserva esta pestaña o exporta tu trabajo antes de cerrarla.",
          );
        }
      } finally {
        running = false;
      }
    }
    function schedule() {
      clearTimeout(timer);
      setStatus(navigator.onLine ? "saving" : "offline");
      timer = setTimeout(() => void sync(), 650);
    }
    removeAction.current = async (id) => {
      if (running || queued || !navigator.onLine || !ack[id]) {
        setNotice(
          "Espera al guardado en tu cuenta y a tener conexión antes de eliminar este lienzo.",
        );
        return false;
      }
      deleting.current = true;
      version.current++;
      try {
        // Keep another existing scene active instead of filling a freed quota slot
        // with an empty scene merely because the rest of the catalog was unloaded.
        let replacement: {scene:PrimitiveScene;revision:number;hash:string}|undefined;
        if (!current.current.scenes.some(s=>s.id!==id)) {
          const candidate=catalogRef.current.find(s=>s.id!==id);
          if(candidate){
            const loaded=await client.from("visual_scenes").select("scene,revision").eq("user_id",owner).in("id",[candidate.id]);
            if(loaded.error||!loaded.data?.[0])throw Error("No se pudo abrir otro lienzo. Actualiza la biblioteca antes de eliminar este.");
            const scene=parsePrimitiveScene(loaded.data[0].scene);
            replacement={scene,revision:loaded.data[0].revision,hash:await hash(scene)};
          }
        }
        if(!alive)return false;
        const result = await client.from("visual_scenes").delete().eq(
          "user_id",
          owner,
        ).eq("id", id).eq("revision", ack[id].revision).select("id")
          .maybeSingle();
        if (!alive) return false;
        if (result.error || !result.data) {
          throw Error(
            "El lienzo cambió en otro dispositivo o no pudo eliminarse. Recarga y vuelve a intentar.",
          );
        }
        const scenes = current.current.scenes.filter((s) => s.id !== id);
        if(replacement){scenes.push(replacement.scene);ack[replacement.scene.id]={revision:replacement.revision,hash:replacement.hash};}
        if (!scenes.length) scenes.push(newPrimitiveScene());
        delete ack[id];
        persistAck();
        store({
          scenes,
          activeId: scenes.some((s) => s.id === current.current.activeId)
            ? current.current.activeId
            : scenes[0]!.id,
        });
        catalogRef.current=catalogRef.current.filter(s=>s.id!==id);
        setCatalog(catalogRef.current);
        setNotice("");
        return true;
      } catch (error) {
        if (alive) {
          setNotice(
            error instanceof Error
              ? error.message
              : "No se pudo eliminar el lienzo.",
          );
        }
        return false;
      } finally {
        deleting.current = false;
        if (alive) schedule();
      }
    };
    saveAction.current = async () => {
      const deadline = Date.now() + 15000;
      do {
        await sync();
        const snapshot = current.current.scenes.find(s => s.id === current.current.activeId)!;
        if (!running && lastSyncFailed) return false;
        if (!running && !queued && ack[snapshot.id]?.hash === await hash(snapshot)) return true;
        if (!navigator.onLine) return false;
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (alive && Date.now() < deadline);
      return false;
    };
    wake.current = schedule;
    function refresh() {
      if (document.visibilityState === "visible") void sync();
    }
    const poll = setInterval(refresh, 20000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    void sync();
    return () => {
      alive = false;
      wake.current = () => {};
      removeAction.current = () => Promise.resolve(false);
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [owner]);
  async function save() {
    const localOk = persistAction.current();
    const ok = owner === "guest" ? localOk : await saveAction.current();
    if (ok) {
      const active = current.current.scenes.find(s => s.id === current.current.activeId)!;
      checkpoints.current.set(active.id, active);
    }
    return ok;
  }
  async function close(id: string, discard: boolean) {
    const baseline = checkpoints.current.get(id);
    if (discard && !baseline) {
      if (owner !== "guest" && !await saveAction.current()) return false;
      if (!await remove(id)) return false;
    } else {
      if (discard && baseline) {
        version.current++;
        store({ ...current.current, scenes: current.current.scenes.map(s => s.id === id ? baseline : s) });
        wake.current();
      }
      if (!await save()) return false;
      const saved = current.current.scenes.find(s => s.id === id);
      if(saved) checkpoints.current.set(id, saved);
    }
    const hidden = [...closedIds, id];
    const remaining = current.current.scenes.find(s => s.id === current.current.activeId && s.id !== id)
      ?? current.current.scenes.find(s => s.id !== id && !hidden.includes(s.id));
    if (remaining) store({ ...current.current, activeId: remaining.id });
    else {
      const blank = newPrimitiveScene("Lienzo sin título");
      checkpoints.current.set(blank.id, null);
      store({ ...current.current, activeId: blank.id, scenes: [...current.current.scenes, blank] });
      version.current++;
      wake.current();
    }
    setClosedIds(hidden);
    return true;
  }
  return {
    save,
    close,
    tabs: collection.scenes.filter(s => !closedIds.includes(s.id) || s.id === collection.activeId).map(s => ({ id: s.id, title: s.title })),
    scene: collection.scenes.find((s) => s.id === collection.activeId)!,
    scenes: [
      ...new Map(
        [
          ...catalog,
          ...collection.scenes.map((s) => ({ id: s.id, title: s.title })),
        ].map((s) => [s.id, s]),
      ).values(),
    ],
    setScene,
    open,
    remove,
    status,
    notice,
  };
}
