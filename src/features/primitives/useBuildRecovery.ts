import { useEffect, useRef, useState } from "react";
import type { PrimitiveScene } from "../../core/primitives/schema";
import { acknowledgeCanvasBuild, buildContent, getCanvasBuild, listCanvasBuilds, type BuildReceipt } from "./buildRecovery";

export function useBuildRecovery({ authenticated, scene, status, busy, current, apply }: {
  authenticated: boolean; scene: PrimitiveScene; status: string; busy: boolean;
  current: () => PrimitiveScene; apply: (receipt: BuildReceipt, separate?: boolean) => boolean;
}) {
  const [available, setAvailable] = useState<BuildReceipt[]>([]);
  const [error, setError] = useState("");
  const actions = useRef({ current, apply });
  const loading = status === "loading";
  const acked = useRef(new Set<string>());
  useEffect(() => { actions.current = { current, apply }; });
  useEffect(() => {
    if (!authenticated || loading || busy) return;
    let alive = true, running = false;
    const poll = async () => {
      if (running || !navigator.onLine) return;
      running = true;
      try {
        const list = await listCanvasBuilds(scene.id);
        const conflicts: BuildReceipt[] = [];
        for (const item of list) {
          if (!alive) return;
          const latest = actions.current.current();
          if (latest.id !== scene.id || latest.appliedBuildIds?.includes(item.id)) continue;
          if (item.state !== "ready" || item.applied_at) continue;
          const receipt = await getCanvasBuild(item.id);
          if (!alive || !receipt || actions.current.current().id !== scene.id) return;
          if (buildContent(actions.current.current()) === buildContent(receipt.source)) {
            actions.current.apply(receipt);
          } else if (!item.applied_at) conflicts.push(receipt);
        }
        if (alive) { setAvailable(conflicts); setError(""); }
      } catch {
        if (alive) setError("No se pudieron consultar las construcciones recuperables. Comprueba la conexión antes de volver a generar.");
      } finally { running = false; }
    };
    const timer = window.setTimeout(() => void poll(), 100);
    const interval = window.setInterval(() => void poll(), 10000);
    const wake = () => { if (document.visibilityState !== "hidden") void poll(); };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      alive = false; clearTimeout(timer); clearInterval(interval);
      window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake);
    };
  }, [authenticated, scene.id, loading, busy]);
  useEffect(() => {
    if (!authenticated || (status !== "saved" && status !== "local")) return;
    for (const id of scene.appliedBuildIds ?? []) {
      if (acked.current.has(id)) continue;
      acked.current.add(id);
      void acknowledgeCanvasBuild(id).catch(() => acked.current.delete(id));
    }
  }, [authenticated, status, scene.appliedBuildIds]);
  return { available: available.filter((r) => r.source.id === scene.id), error };
}
