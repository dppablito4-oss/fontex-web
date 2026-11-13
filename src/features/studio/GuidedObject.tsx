import { useContext, useState } from "react";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import type { MathObject } from "../../core/document-schema/document";
import { ObjectVisual } from "./MathObjectRenderer";
import { TeachingLevel } from "./teaching-level";
import { TeachingMode } from "./teaching-mode";
import { lessonSteps } from "./lesson-steps";
import { exactTarget, practiceReply } from "../../core/agent/pedagogy";
import { parseStudioOperation } from "../../core/math-engine/studio-operations";

export function GuidedObject({ object }: { object: MathObject }) {
  const mode = useContext(TeachingMode), level = useContext(TeachingLevel);
  const steps = lessonSteps(object, level);
  const [step, setStep] = useState(() => object.type === "operation" ? object.data.stage === 2 ? 4 : object.data.stage === 1 ? 2 : 0 : object.type === "linear-equation" ? object.data.stage === 2 ? 3 : object.data.stage === 1 ? 2 : 0 : 0);
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState(0);
  const [feedback, setFeedback] = useState("");
  const dataKey = JSON.stringify(object.data);
  const [previousData, setPreviousData] = useState(dataKey);
  if (dataKey !== previousData) {
    setPreviousData(dataKey); setStep(0); setAnswer(""); setHint(0); setFeedback("");
  }
  const current = Math.min(step, Math.max(0, steps.length - 1));
  const practice = mode === "practice";
  let visual = object;
  if (object.type === "operation") {
    const multiply = parseStudioOperation(object.data.expression).operator === "×";
    visual = { ...object, data: { ...object.data, stage: practice ? 0 : mode === "solve" ? 2 : current < 2 ? 0 : current < (multiply ? 3 : 4) ? 1 : 2 } };
  }
  if (object.type === "linear-equation") visual = { ...object, data: { ...object.data, stage: practice ? 0 : mode === "solve" ? 2 : current < 1 ? 0 : current < 3 ? 1 : 2 } };
  if (object.type === "text") return <div className="st-story-text"><ObjectVisual object={object} onChange={() => {}} /></div>;
  const target = exactTarget(object);
  function check(nextHint: number) {
    setHint(nextHint);
    setFeedback(practiceReply({ document: { schemaVersion: 1, id: "practice-preview", title: "Práctica", updatedAt: new Date().toISOString(), objects: [object] }, selectedId: object.id, mode: "practice", level, question: "Practicar", attempt: answer, hintLevel: nextHint }).message);
  }
  return <div className={`st-guided st-guided-${mode} ${["fraction", "operation", "number-line", "geometry", "regular-polygon", "polygon", "circle", "angle"].includes(object.type) ? "st-guided-wide" : ""}`}>
    <div className="st-visual-panel" aria-label="Representación visual"><ObjectVisual object={visual} onChange={() => {}} lessonStep={mode === "solve" ? Infinity : current} concealAnswers={practice} /></div>
    <section className="st-story-panel" aria-label={practice ? "Práctica del módulo" : "Pasos del módulo"}>
      {practice ? <>
        <span className="st-story-eyebrow">TU TURNO</span><h3>{target?.prompt}</h3>
        <p>Observa la representación. Puedes pedir una pista cuando la necesites.</p>
        <form onSubmit={e => { e.preventDefault(); check(hint); }}><label>Respuesta del módulo<input value={answer} onChange={e => { setAnswer(e.target.value); setFeedback(""); }} maxLength={120} placeholder={object.type === "factorization" ? "Ejemplo: 2^2 × 3" : object.type === "circle" ? "Ejemplo: 9π" : object.type === "statistics" && object.data.task === "mode" ? "Ejemplo: 2, 3 o sin moda" : "Ejemplo: 3/2"} /></label><button className="st-primary" type="submit">Comprobar respuesta</button></form>
        {feedback && <p role="status" className="st-story-feedback">{feedback}</p>}
        <button type="button" disabled={hint >= 2} onClick={() => check(hint + 1)}><Lightbulb size={16} />{hint === 0 ? "Dame una pista" : hint === 1 ? "Mostrar comprobación" : "Comprobación mostrada"}</button>
      </> : mode === "solve" ? <>
        <span className="st-story-eyebrow">RESOLUCIÓN COMPLETA</span><h3>{target ? `Resultado: ${target.result}` : object.label}</h3>
        <ol className="st-solution-list">{steps.map(([title, text], i) => <li key={title}><strong>{i + 1}. {title}</strong><p>{text}</p></li>)}</ol>
      </> : <>
        <span className="st-story-eyebrow">PASO {current + 1} DE {steps.length}</span>
        <h3>{steps[current]?.[0]}</h3><p className="st-story-copy" aria-live="polite">{steps[current]?.[1]}</p>
        <div className="st-progress" aria-hidden="true">{steps.map((_, i) => <span key={i} className={i <= current ? "active" : ""} />)}</div>
        <nav className="st-story-navigation" aria-label="Recorrer explicación"><button disabled={current === 0} onClick={() => setStep(current - 1)}><ArrowLeft size={16} />Anterior paso</button><button className="st-primary" disabled={current === steps.length - 1} onClick={() => setStep(current + 1)}>Siguiente paso<ArrowRight size={16} /></button></nav>
        {current === steps.length - 1 && <p className="st-story-feedback">Ya recorriste la explicación. Cuenta con tus palabras qué cambió y qué se conservó.</p>}
      </>}
    </section>
  </div>;
}
