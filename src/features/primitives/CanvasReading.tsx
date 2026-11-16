import { useEffect, useState } from "react";
import { lessonSequence } from "../../core/primitives/lesson-flow";
import { FractionLesson } from "./FractionLesson";
import type { Primitive } from "../../core/primitives/schema";
import { PrimitiveVisual } from "./PrimitiveVisual";
import { sceneFunctions, sceneScope } from "../../core/primitives/math";
import { workspaceRoots } from "../../core/primitives/layout";
import type { PrimitiveScene } from "../../core/primitives/schema";
import { readPublicCanvas } from "./sharing";
import { SiteHeader } from "../../components/ProductNavigation";
import "./primitives.css";

export function CanvasReading({ scene, practice = false, onPracticeChange }: { scene: PrimitiveScene; practice?: boolean; onPracticeChange?: (scene: PrimitiveScene) => void }) {
  const scope = sceneScope(scene), functions = sceneFunctions(scene);
  const visual = (p: Primitive) => <PrimitiveVisual p={p} scene={scene} scope={scope} functions={functions} selected={false}
    readOnly practice={practice} onPracticeChange={onPracticeChange} onChange={() => {}} onVariable={() => {}} onSelect={() => {}} />;
  return <div className="pc-reading-content">{lessonSequence(scene, workspaceRoots(scene)).map(item =>
    <section className="pc-export-item" key={item.id} data-lesson-step={item.step}>
      {item.kind === "fraction" ? <FractionLesson lesson={item.lesson} renderPrimitive={visual} />
        : <>{item.primitive.label && <h2>{item.primitive.label}</h2>}{visual(item.primitive)}</>}
    </section>)}</div>;
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
