import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import type { Json } from "../../lib/supabase/database.types";
import type { ConversationTurn } from "../../core/agent/conversation";
import { chatKey, mergeWorkspaces, parseConversations, parseWorkspace, readWorkspace, revisionKey, sameWorkspace, workspaceEvent, workspaceHash, writeWorkspace, type Workspace } from "./workspace-sync";

type SyncStatus = "local" | "loading" | "saving" | "saved" | "offline" | "error";
export function useStudioCloud(owner: string, onHydrate: () => void) {
  const [conversations, setConversations] = useState<Workspace["conversations"]>(() => {
    try { return parseConversations(JSON.parse(localStorage.getItem(chatKey(owner)) ?? "{}") as unknown); } catch { return {}; }
  });
  const [status, setStatus] = useState<SyncStatus>(owner === "guest" ? "local" : "loading");
  const [notice, setNotice] = useState("");
  const hydrate = useRef(onHydrate);
  useEffect(() => { hydrate.current = onHydrate; }, [onHydrate]);
  useEffect(() => {
    if (owner === "guest" || !supabase) return;
    const client = supabase;
    let alive = true, running = false, requested = false, revision = 0;
    let base: Workspace | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = revisionKey(owner);
    async function sync() {
      requested = true;
      if (running) return;
      running = true;
      try {
        while (requested && alive) {
          requested = false;
          if (!navigator.onLine) { setStatus("offline"); break; }
          setStatus("saving");
          const result = await client.from("studio_workspaces").select("state,revision").eq("user_id", owner).maybeSingle();
          if (!alive) return;
          if (result.error) throw result.error;
          let local = readWorkspace(owner);
          if (!base) {
            const ack: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
            if (ack && typeof ack === "object" && "hash" in ack && ack.hash === await workspaceHash(local)) base = local;
          }
          local = readWorkspace(owner);
          if (result.data) {
            const remote = parseWorkspace(result.data.state);
            revision = result.data.revision;
            const merged = mergeWorkspaces(base, local, remote);
            if (!sameWorkspace(merged.state, local)) {
              // No await between the latest local read and applying the merge.
              writeWorkspace(owner, merged.state); local = merged.state;
              setConversations(local.conversations); hydrate.current();
            }
            if (merged.copies) setNotice("Había cambios en dos dispositivos. Conservamos ambas versiones; la tuya aparece como copia local.");
            if (sameWorkspace(local, remote)) {
              base = remote; localStorage.setItem(key, JSON.stringify({ revision, hash: await workspaceHash(remote) }));
              if (alive) setStatus("saved");
              continue;
            }
          } else revision = 0;
          const payload = { user_id: owner, state: local as unknown as Json, revision: revision + 1 };
          const saved = revision === 0
            ? await client.from("studio_workspaces").insert(payload).select("revision").single()
            : await client.from("studio_workspaces").update({ state: payload.state, revision: payload.revision }).eq("user_id", owner).eq("revision", revision).select("revision").maybeSingle();
          if (!alive) return;
          if (saved.error?.code === "23505" || (!saved.error && !saved.data)) { requested = true; continue; }
          if (saved.error) throw saved.error;
          revision = saved.data!.revision; base = local;
          localStorage.setItem(key, JSON.stringify({ revision, hash: await workspaceHash(local) }));
          if (alive) setStatus("saved");
        }
      } catch {
        if (alive) { setStatus(navigator.onLine ? "error" : "offline"); setNotice("Los cambios siguen en este dispositivo. No se pudo sincronizar; volveremos a intentarlo."); }
      } finally { running = false; }
    }
    function schedule(event?: Event) {
      if (event instanceof CustomEvent && event.detail !== owner) return;
      clearTimeout(timer); setStatus("saving"); timer = setTimeout(() => { void sync(); }, 800);
    }
    function refresh() { if (document.visibilityState === "visible") void sync(); }
    function offline() { setStatus("offline"); }
    window.addEventListener(workspaceEvent, schedule); window.addEventListener("focus", refresh); window.addEventListener("online", refresh); window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", refresh);
    const poll = setInterval(refresh, 20000);
    void sync();
    return () => { alive = false; clearTimeout(timer); clearInterval(poll); window.removeEventListener(workspaceEvent, schedule); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", refresh); };
  }, [owner]);
  function setConversation(id: string, turns: ConversationTurn[], canPersist = true) {
    setConversations(previous => ({ ...previous, [id]: turns.slice(-80) }));
    if (!canPersist) { setNotice("El chat sigue abierto, pero no se pudo guardar el material. Exporta una copia antes de cerrar."); setStatus("error"); return; }
    try {
      const current = parseConversations(JSON.parse(localStorage.getItem(chatKey(owner)) ?? "{}") as unknown);
      const ids = new Set(readWorkspace(owner).documents.map(d => d.id));
      const next = { ...Object.fromEntries(Object.entries(current).filter(([key]) => ids.has(key))), [id]: turns.slice(-80) };
      localStorage.setItem(chatKey(owner), JSON.stringify(next)); setConversations(next);
      window.dispatchEvent(new CustomEvent(workspaceEvent, { detail: owner }));
    } catch { setNotice("No se pudo guardar el chat. Tu material sigue disponible."); setStatus("error"); }
  }
  return { conversations, setConversation, status, notice };
}
