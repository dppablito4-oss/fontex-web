import { useEffect, useRef, useState, type SetStateAction } from "react";
import { expressionScene, parseScene, type Scene } from "../../core/scene/document";
import { supabase } from "../../lib/supabase/client";
import type { Json } from "../../lib/supabase/database.types";
import { readWorkspace } from "../studio/workspace-sync";
import { migrateMaterial } from "./scene-migration";
type Collection = { activeId: string; scenes: Scene[]; fresh?: boolean };
type Ack = Record<string, { revision: number; hash: string }>;
const cacheKey = (owner: string) => `fontex-scenes-v1:${owner}`;
function initial(owner: string): Collection {
  let scenes: Scene[] = [], activeId = "", recovered = false;
  try { const raw = JSON.parse(localStorage.getItem(cacheKey(owner)) ?? "null") as Collection | null; if (raw && Array.isArray(raw.scenes)) { scenes = raw.scenes.map(parseScene); activeId = raw.activeId; recovered = true; } } catch { /* Cloud remains available if local data cannot be read. */ }
  try { const old = localStorage.getItem(`fontex-general-prototype:${owner}`); if (old && !recovered) { const scene = parseScene(JSON.parse(old) as unknown); if (!scenes.some(s => s.id === scene.id)) { scenes.push(scene); activeId ||= scene.id; } } } catch { /* The old original remains untouched. */ }
  try { const workspace = readWorkspace(owner); for (const doc of workspace.documents) { const scene = migrateMaterial(doc, workspace.conversations[doc.id]); if (!scenes.some(s => s.id === scene.id)) scenes.push(scene); } if (!activeId && workspace.activeId) activeId = `import-${workspace.activeId}`; } catch { /* Imported originals are still in the previous editor. */ }
  const fresh = !scenes.length;
  if (!scenes.length) scenes.push(expressionScene("a*x^2 + b*x + c"));
  return { scenes, fresh, activeId: scenes.some(s => s.id === activeId) ? activeId : scenes[0]!.id };
}
async function hash(scene: Scene) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(scene))); return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,"0")).join(""); }
export function useSceneStore(owner: string) {
  const [collection, setCollection] = useState(() => initial(owner));
  const current = useRef(collection), version = useRef(0), wake = useRef<() => void>(() => {});
  const [status, setStatus] = useState(owner === "guest" ? "local" : "loading"), [notice, setNotice] = useState("");
  function store(next: Collection) { current.current = next; setCollection(next); try { localStorage.setItem(cacheKey(owner), JSON.stringify(next)); } catch { setNotice("No se pudo guardar la copia local. Exporta la escena si estás sin conexión."); } }
  function setScene(change: SetStateAction<Scene>) {
    const old = current.current.scenes.find(s => s.id === current.current.activeId)!;
    const updated = typeof change === "function" ? change(old) : change;
    const scene = parseScene({ ...updated, updatedAt: new Date().toISOString() });
    version.current++;
    store({ activeId: scene.id, scenes: [...current.current.scenes.filter(s => s.id !== scene.id), scene] });
    wake.current();
  }
  function open(id: string) { if (current.current.scenes.some(s => s.id === id)) { version.current++; store({ ...current.current, activeId: id }); } }
  useEffect(() => {
    if (owner === "guest" || !supabase) return;
    const client = supabase, ackKey = `${cacheKey(owner)}:ack`;
    let ack: Ack = {}; try { ack = JSON.parse(localStorage.getItem(ackKey) ?? "{}") as Ack; } catch { /* Reconcile conservatively. */ }
    let alive = true, running = false, queued = false, timer: ReturnType<typeof setTimeout> | undefined;
    async function sync() {
      queued = true; if (running) return; running = true;
      try {
        let attempts = 0;
        while (queued && alive && attempts++ < 4) {
          queued = false;
          if (!navigator.onLine) { setStatus("offline"); break; }
          setStatus("saving");
          const result = await client.from("visual_scenes").select("scene,revision").eq("user_id", owner).order("updated_at", { ascending: false });
          if (!alive) return; if (result.error) throw result.error;
          const snapshotVersion = version.current;
          let scenes = [...current.current.scenes], activeId = current.current.activeId, copied = false;
          const remote = new Map<string, { scene: Scene; revision: number; hash: string }>();
          for (const row of result.data) { const scene = parseScene(row.scene); remote.set(scene.id, { scene, revision: row.revision, hash: await hash(scene) }); }
          if (remote.size && current.current.fresh && snapshotVersion === 0) { scenes = []; activeId = remote.keys().next().value ?? activeId; }
          for (const [id, row] of remote) {
            const local = scenes.find(s => s.id === id);
            if (!local) { scenes.push(row.scene); ack[id] = { revision: row.revision, hash: row.hash }; continue; }
            const localHash = await hash(local), base = ack[id];
            if (localHash === row.hash) { ack[id] = { revision: row.revision, hash: row.hash }; continue; }
            if (base?.revision === row.revision) continue;
            if (base?.hash !== localHash) {
              const copy = { ...local, id: crypto.randomUUID(), title: `${local.title.slice(0,100)} (copia local)` };
              scenes.push(copy); if (activeId === id) activeId = copy.id; copied = true;
            }
            scenes = scenes.map(s => s.id === id ? row.scene : s); ack[id] = { revision: row.revision, hash: row.hash };
          }
          if (snapshotVersion !== version.current) { queued = true; continue; }
          const merged = { activeId, scenes }; current.current = merged; setCollection(merged);
          try { localStorage.setItem(cacheKey(owner), JSON.stringify(merged)); } catch { /* A cloud save can still succeed. */ }
          if (copied) setNotice("Conservamos una copia local porque había cambios en otro dispositivo.");
          for (const scene of scenes) {
            const fingerprint = await hash(scene), row = remote.get(scene.id);
            if (fingerprint === row?.hash) continue;
            const revision = row?.revision ?? 0;
            const saved = revision === 0
              ? await client.from("visual_scenes").insert({ user_id: owner, id: scene.id, scene: scene as unknown as Json, revision: 1 }).select("revision").single()
              : await client.from("visual_scenes").update({ scene: scene, revision: revision + 1 }).eq("user_id", owner).eq("id", scene.id).eq("revision", revision).select("revision").maybeSingle();
            if (!alive) return;
            if (saved.error?.code === "23505") { queued = true; break; }
            if (saved.error) throw saved.error;
            if (!saved.data) { queued = true; break; }
            ack[scene.id] = { revision: saved.data.revision, hash: fingerprint };
          }
          localStorage.setItem(ackKey, JSON.stringify(ack));
          if (alive) setStatus(queued ? "saving" : "saved");
        }
      } catch { if (alive) { setStatus(navigator.onLine ? "error" : "offline"); setNotice("La sincronización está pendiente. Tus cambios siguen en este dispositivo."); } }
      finally { running = false; }
    }
    function schedule() { clearTimeout(timer); setStatus(navigator.onLine ? "saving" : "offline"); timer = setTimeout(() => void sync(), 650); }
    wake.current = schedule;
    function refresh() { if (document.visibilityState === "visible") void sync(); }
    const poll = setInterval(refresh, 20000); window.addEventListener("online", refresh); window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    void sync();
    return () => { alive = false; wake.current = () => {}; clearTimeout(timer); clearInterval(poll); window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [owner]);
  return { scene: collection.scenes.find(s => s.id === collection.activeId)!, scenes: collection.scenes, setScene, open, status, notice };
}
