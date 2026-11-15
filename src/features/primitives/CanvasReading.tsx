import { useEffect, useState } from "react";
import { fractionLessons } from "../../core/primitives/fraction-lessons";
import { FractionLesson } from "./FractionLesson";
import type { Primitive } from "../../core/primitives/schema";
import { PrimitiveVisual } from "./PrimitiveVisual";
import { sceneFunctions, sceneScope } from "../../core/primitives/math";
import { workspaceRoots } from "../../core/primitives/layout";
import type { PrimitiveScene } from "../../core/primitives/schema";
import { readPublicCanvas } from "./sharing";
import { SiteHeader } from "../../components/ProductNavigation";
import "./primitives.css";

export function CanvasReading({ scene }: { scene: PrimitiveScene }) {
  const lessons = fractionLessons(scene);
  const members = new Set(lessons.flatMap(l => [...l.texts, ...l.figures].map(p => p.id)));
  const visual = (p: Primitive) => <PrimitiveVisual p={p} scene={scene} scope={sceneScope(scene)} functions={sceneFunctions(scene)} selected={false}
    readOnly onChange={() => {}} onVariable={() => {}} onSelect={() => {}} />;
  const items = [
    ...lessons.map(lesson => ({ id: lesson.id, step: lesson.step, y: Math.min(...lesson.texts.map(p => p.y),...lesson.figures.map(p => p.y)),
      content: <FractionLesson lesson={lesson} renderPrimitive={p => visual(p)} /> })),
    ...workspaceRoots(scene).filter(p => !members.has(p.id)).map(p => ({ id: p.id, step: p.presentationStep, y: p.y,
      content: <>{p.label && <h2>{p.label}</h2>}{visual(p)}</> })),
  ].sort((a,b) => a.step-b.step || a.y-b.y);
  return <div className="pc-reading-content">{items.map(item =>
    <section className="pc-export-item" key={item.id}>{item.content}</section>)}</div>;
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
