import { useContext, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { StudioDocument } from "../../core/document-schema/document";
import { GuidedObject } from "./GuidedObject";
import { TeachingMode } from "./teaching-mode";
import { agentModes } from "../../core/agent/protocol";
export function LessonPlayer({ document, onClose }: { document: StudioDocument; onClose: () => void }) {
  const objects = [...document.objects].sort((a, b) => a.y - b.y || a.x - b.x);
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const mode = useContext(TeachingMode);
  const object = objects[index];
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="st-lesson-player" onClose={onClose} aria-label="Recorrido del material">
    <header><div><small>{agentModes[mode]} · {index + 1} / {objects.length}</small><h2>{object?.label ?? document.title}</h2></div><button aria-label="Cerrar recorrido" onClick={onClose}><X size={22} /></button></header>
    <main key={object?.id} data-module-type={object?.type}>{object ? <GuidedObject key={`${object.id}:${mode}:${JSON.stringify(object.data)}`} object={object} /> : <p>Añade módulos para comenzar el recorrido.</p>}</main>
    <footer><button disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft size={18} />Módulo anterior</button><span>{document.title}</span><button className="st-primary" disabled={index >= objects.length - 1} onClick={() => setIndex(index + 1)}>Siguiente módulo<ArrowRight size={18} /></button></footer>
  </dialog>;
}
