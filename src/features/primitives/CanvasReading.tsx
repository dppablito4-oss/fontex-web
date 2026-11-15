import { useEffect, useState } from "react";
import { PrimitiveVisual } from "./PrimitiveVisual";
import { sceneFunctions, sceneScope } from "../../core/primitives/math";
import { workspaceRoots } from "../../core/primitives/layout";
import type { PrimitiveScene } from "../../core/primitives/schema";
import { readPublicCanvas } from "./sharing";
import { SiteHeader } from "../../components/ProductNavigation";
import "./primitives.css";

export function CanvasReading({ scene }: { scene: PrimitiveScene }) {
  return <div className="pc-reading-content">
    {workspaceRoots(scene).sort((a,b) => a.y - b.y || a.x - b.x).map(p => <section className="pc-export-item" key={p.id}>
      {p.label && <h2>{p.label}</h2>}
      <PrimitiveVisual p={p} scene={scene} scope={sceneScope(scene)} functions={sceneFunctions(scene)} selected={false}
        readOnly onChange={() => {}} onVariable={() => {}} onSelect={() => {}} />
    </section>)}
  </div>;
}
export function SharedCanvasPage({ token }: { token: string }) {
  const [scene, setScene] = useState<PrimitiveScene | null>(null), [error,setError] = useState("");
  useEffect(() => {
    let live = true;
    readPublicCanvas(token).then(value => { if(live) setScene(value); }).catch((e: unknown) => { if(live) setError(e instanceof Error ? e.message : "No se pudo abrir el enlace."); });
    return () => { live = false; };
  }, [token]);
  return <div className="pc-app pc-public-page"><SiteHeader />
    <main className="pc-public-content">
      <h1>{scene?.title || "Lienzo compartido"}</h1>
      <p>Vista de solo lectura · Compartido por su autor</p>
      {error ? <p role="alert">{error}</p> : scene ? <CanvasReading scene={scene} /> : <p role="status">Abriendo lienzo…</p>}
    </main>
  </div>;
}
