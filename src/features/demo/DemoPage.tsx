import {
  ArrowLeft, ArrowRight, Atom, BookOpen, Check, ChevronRight, CircleHelp,
  ClipboardList, FileText, GraduationCap, LayoutGrid, LibraryBig, Lightbulb, LoaderCircle,
  LockKeyhole, MessageSquareText, Plus, Send, Sigma, Trash2,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";

import { BrandMark } from "../../components/BrandMark";
import { PdfViewer } from "../library/components/PdfViewer";
import { type Citation, type DemoMaterial, type Exchange, findCitation, indexMaterial, readMaterials, writeMaterial } from "./demoService";
import lessons from "./lessons.json";
import "./demo.css";

const sections = [
  { id: "aula", label: "Mi aula", icon: LayoutGrid },
  { id: "biblioteca", label: "Biblioteca", icon: LibraryBig },
  { id: "tutor", label: "Tutor", icon: MessageSquareText },
  { id: "practica", label: "Práctica", icon: ClipboardList },
] as const;

type Section = (typeof sections)[number]["id"];
type Progress = { answers: Record<number, number>; exchanges: Exchange[] };
type Saved = { lessonId: string; progress: Record<string, Progress> };
type Viewer = { document: { title: string; originalFilename: string }; blob: Blob; page: number };

const storageKey = "fontex-aula-demo-v1";
const defaultLesson = lessons[0]!;
const emptyProgress: Progress = { answers: {}, exchanges: [] };

function readProgress(): Saved {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const data = JSON.parse(raw) as Saved;
      if (lessons.some(({ id }) => id === data.lessonId) && data.progress) return data;
    }
  } catch {
    // The classroom is usable when the browser blocks local storage.
  }
  return { lessonId: defaultLesson.id, progress: {} };
}

function HeroArt() {
  return (
    <svg className="fd-art" viewBox="0 0 390 250" fill="none" aria-hidden="true">
      <defs>
        <pattern id="fd-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="#9de8ff" strokeOpacity=".19" /></pattern>
        <linearGradient id="fd-line" x1="70" y1="220" x2="330" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor="#67e8f9" /><stop offset="1" stopColor="#c2a9ff" /></linearGradient>
        <radialGradient id="fd-fade"><stop stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" /></radialGradient>
        <mask id="fd-mask"><ellipse cx="210" cy="128" rx="184" ry="136" fill="url(#fd-fade)" /></mask>
      </defs>
      <path d="M27 5h360v240H27z" fill="url(#fd-grid)" mask="url(#fd-mask)" />
      <ellipse cx="227" cy="125" rx="151" ry="70" transform="rotate(-25 227 125)" stroke="#a5b4fc" strokeOpacity=".5" />
      <ellipse cx="227" cy="125" rx="123" ry="53" transform="rotate(37 227 125)" stroke="#a5b4fc" strokeOpacity=".45" />
      <path d="M71 201h265m-235 23V32" stroke="#c7d2fe" strokeOpacity=".7" strokeLinecap="round" />
      <path d="M98 187c39-1 57-13 79-37 28-30 49-34 74-45 35-15 56-36 73-70" stroke="url(#fd-line)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M177 150v51m74-96v96" stroke="#a9c3ff" strokeDasharray="4 5" strokeOpacity=".75" />
      <circle cx="177" cy="150" r="4.5" fill="#a5f3fc" />
      <circle cx="251" cy="105" r="5" fill="#c4b5fd" />
      <circle cx="324" cy="35" r="4.5" fill="#e0e7ff" />
      <circle cx="285" cy="175" r="3" fill="#a5f3fc" />
      <path d="M119 58h12m-6-6v12m218 53h16m-8-8v16M152 223h10m-5-5v10" stroke="#b8c4ff" strokeOpacity=".8" strokeLinecap="round" />
    </svg>
  );
}

export function DemoPage() {
  const [saved, setSaved] = useState(readProgress);
  const [section, setSection] = useState<Section>("aula");
  const [materials, setMaterials] = useState<Record<string, DemoMaterial | undefined>>({});
  const [materialBusy, setMaterialBusy] = useState(true);
  const [viewerBusy, setViewerBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [question, setQuestion] = useState("");
  const [hints, setHints] = useState<number[]>([]);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sourceTrigger = useRef<HTMLElement | null>(null);

  const lesson = lessons.find(({ id }) => id === saved.lessonId) ?? defaultLesson;
  const progress = saved.progress[lesson.id] ?? emptyProgress;
  const material = materials[lesson.id];
  const answered = Object.keys(progress.answers).length;
  const correct = lesson.questions.filter((item, i) => item.correct === progress.answers[i]).length;
  const CourseIcon = lesson.id === "fisica" ? Atom : Sigma;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Fontex · Aula de práctica";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    let active = true;
    void readMaterials().then((data) => {
      if (active) setMaterials(data);
    }).catch(() => {
      if (active) setNotice({ text: "El navegador bloqueó el acceso a los PDF guardados.", error: true });
    }).finally(() => {
      if (active) setMaterialBusy(false);
    });
    return () => { active = false; };
  }, []);

  function save(next: Saved) {
    setSaved(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setStorageError(true);
    }
  }

  function updateProgress(next: Progress) {
    save({ ...saved, progress: { ...saved.progress, [lesson.id]: next } });
  }

  function navigate(next: Section) {
    setSection(next);
    setNotice(null);
    window.scrollTo(0, 0);
    window.requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  function selectLesson(id: string) {
    if (id === lesson.id) return;
    save({ ...saved, lessonId: id });
    setQuestion("");
    setHints([]);
    setSelected({});
    navigate("aula");
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setMaterialBusy(true);
    setNotice(null);
    try {
      const next = await indexMaterial(file);
      await writeMaterial(lesson.id, next);
      setMaterials((previous) => ({ ...previous, [lesson.id]: next }));
      setNotice({ text: `${next.title} listo para consultar. ${next.pages.length} pág.` });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "No se pudo añadir el PDF en este navegador.", error: true });
    } finally {
      setMaterialBusy(false);
    }
  }

  async function removeMaterial() {
    setMaterialBusy(true);
    setNotice(null);
    try {
      await writeMaterial(lesson.id);
      setMaterials((previous) => ({ ...previous, [lesson.id]: undefined }));
      setNotice({ text: "Se quitó el PDF añadido de esta aula." });
    } catch {
      setNotice({ text: "No se pudo quitar el PDF. Intenta de nuevo.", error: true });
    } finally {
      setMaterialBusy(false);
    }
  }

  async function openSource(sourceId: string, page: number) {
    sourceTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNotice(null);
    if (material?.id === sourceId) {
      setViewer({ document: { title: material.title, originalFilename: material.filename }, blob: material.pdf, page });
      return;
    }
    if (sourceId !== lesson.id) {
      setNotice({ text: "Este PDF ya no está en el aula. Puedes seguir leyendo el fragmento guardado.", error: true });
      return;
    }
    setViewerBusy(true);
    try {
      const result = await fetch(`${import.meta.env.BASE_URL}demo/${lesson.pdf}`);
      if (!result.ok) throw new Error("No se pudo abrir la guía.");
      setViewer({ document: { title: lesson.source, originalFilename: lesson.pdf }, blob: await result.blob(), page });
    } catch {
      setNotice({ text: "No se pudo abrir la guía. Comprueba tu conexión e inténtalo de nuevo.", error: true });
    } finally {
      setViewerBusy(false);
    }
  }

  function ask(value: string) {
    if (materialBusy) return;
    const text = value.trim();
    if (!text) return;
    const citation = findCitation(text, lesson, material);
    updateProgress({ ...progress, exchanges: [...progress.exchanges, { question: text, citation }].slice(-20) });
    setQuestion("");
  }

  function checkAnswer(index: number, event: FormEvent) {
    event.preventDefault();
    const answer = selected[index];
    if (answer === undefined || progress.answers[index] !== undefined) return;
    updateProgress({ ...progress, answers: { ...progress.answers, [index]: answer } });
  }

  function cite(citation: Citation) {
    return (
      <button className="fd-cite" disabled={viewerBusy} onClick={() => void openSource(citation.sourceId, citation.page)} type="button">
        <FileText size={15} /> <span>{citation.title} · p. {citation.page}</span> <ArrowRight size={14} />
      </button>
    );
  }

  return (
    <div className="fd">
      <aside className="fd-side" aria-label="Menú del aula" inert={Boolean(viewer)}>
        <div className="fd-brand"><BrandMark /><span>AULA VIRTUAL</span></div>
        <p className="fd-nav-label">ESPACIO DE ESTUDIO</p>
        <nav className="fd-nav" aria-label="Secciones">
          {sections.map(({ id, label, icon: Icon }) => (
            <button aria-current={section === id ? "page" : undefined} className="fd-nav-button" key={id} onClick={() => navigate(id)} type="button">
              <Icon size={19} /><span>{label}</span><ChevronRight className="fd-nav-arrow" size={15} />
            </button>
          ))}
        </nav>
        <p className="fd-nav-label fd-course-label">MIS CURSOS</p>
        <div className="fd-course-nav" role="group" aria-label="Cursos">
          {lessons.map((item) => {
            const Icon = item.id === "fisica" ? Atom : Sigma;
            return (
              <button aria-pressed={item.id === lesson.id} className="fd-course-choice" key={item.id} onClick={() => selectLesson(item.id)} type="button">
                <Icon size={17} /><span>{item.subject}</span>
              </button>
            );
          })}
        </div>
        <div className="fd-side-bottom"><span><GraduationCap size={20} /></span><div><strong>Estudiante demo</strong><small>Sesión local</small></div></div>
      </aside>
      <div className="fd-workspace" inert={Boolean(viewer)}>
        <header className="fd-top">
          <div className="fd-crumb"><span>Aula virtual</span><ChevronRight size={14} /><strong>{lesson.subject}</strong></div>
          <span className="fd-badge"><i /> Modo demostración</span>
        </header>
        <main className="fd-main">
          {section === "aula" ? (
            <>
              <div className="fd-intro"><p className="fd-kicker"><CourseIcon size={16} /> {lesson.code} · UNIDAD 01</p><h1 ref={heading} tabIndex={-1}>Mi aula de práctica</h1><p>Lee, consulta tus fuentes y comprueba lo que aprendiste.</p></div>
              <section className="fd-hero" aria-labelledby="lesson-title">
                <HeroArt />
                <div className="fd-hero-copy">
                  <span className="fd-hero-label"><span /> TEMA DE ESTUDIO</span>
                  <h2 id="lesson-title">{lesson.title}</h2>
                  <p>{lesson.description}</p>
                  <button className="fd-button fd-button-light" onClick={() => navigate("practica")} type="button">{answered ? "Ver mi práctica" : "Empezar práctica"} <ArrowRight size={17} /></button>
                </div>
              </section>
              <div className="fd-dashboard">
                <section className="fd-panel fd-steps" aria-labelledby="fd-steps">
                  <div className="fd-panel-head"><div><p className="fd-kicker">RECORRIDO</p><h2 id="fd-steps">Sigue esta ruta</h2></div></div>
                  {[
                    { id: "biblioteca", title: "Lee la guía del tema", detail: "PDF breve · 2 páginas", icon: BookOpen },
                    { id: "tutor", title: "Consulta al tutor", detail: "Encuentra el fragmento y abre su página", icon: MessageSquareText },
                    { id: "practica", title: "Resuelve la actividad", detail: "3 ejercicios con pistas y corrección", icon: ClipboardList },
                  ].map(({ id, title, detail, icon: Icon }, index) => (
                    <button className="fd-step" key={id} onClick={() => navigate(id as Section)} type="button">
                      <span className={`fd-step-icon fd-step-${index}`}><Icon size={20} /></span>
                      <span><strong>{title}</strong><small>{detail}</small></span>
                      <ArrowRight size={17} className="fd-step-arrow" />
                    </button>
                  ))}
                </section>
                <section className="fd-panel fd-progress" aria-labelledby="fd-progress">
                  <p className="fd-kicker">TU AVANCE</p><h2 id="fd-progress">Práctica de la unidad</h2>
                  <p className="fd-progress-numbers"><strong>{answered}</strong><span> / {lesson.questions.length} resueltos</span></p>
                  <progress aria-label="Ejercicios resueltos" max={lesson.questions.length} value={answered} />
                  <p>{answered ? `${correct} ${correct === 1 ? "acierto" : "aciertos"} hasta ahora.` : "Tu avance aparecerá al responder."}</p>
                </section>
              </div>
            </>
          ) : (
            <>
              <button className="fd-back" onClick={() => navigate("aula")} type="button"><ArrowLeft size={16} /> Volver a mi aula</button>
              <div className="fd-intro">
                <p className="fd-kicker"><CourseIcon size={16} /> {lesson.code} · {lesson.title}</p>
                <h1 ref={heading} tabIndex={-1}>{section === "biblioteca" ? "Biblioteca del aula" : section === "tutor" ? "Tutor con fuentes" : "Práctica guiada"}</h1>
                <p>{section === "biblioteca" ? "Abre la guía del tema o añade un PDF que puedas consultar aquí." : section === "tutor" ? "Escribe una pregunta y consulta el fragmento más relevante de tus lecturas." : "Elige una respuesta, compruébala y revisa la explicación."}</p>
              </div>
            </>
          )}

          {notice && <p className={`fd-notice ${notice.error ? "fd-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
          {storageError && <p className="fd-notice fd-error" role="alert">El navegador bloqueó el guardado del avance. Puedes continuar en esta pestaña.</p>}

          {section === "biblioteca" && (
            <section className="fd-panel fd-content-panel" aria-labelledby="fd-materials">
              <div className="fd-panel-head fd-flex"><div><p className="fd-kicker">LECTURAS</p><h2 id="fd-materials">Materiales del tema</h2></div>
                <input accept=".pdf,application/pdf" aria-label="Seleccionar PDF" hidden onChange={(event) => void upload(event)} ref={fileInput} type="file" />
                <button className="fd-button" disabled={materialBusy} onClick={() => fileInput.current?.click()} type="button">{materialBusy ? <LoaderCircle className="fd-spin" size={17} /> : <Plus size={17} />} {material ? "Reemplazar PDF" : "Añadir PDF"}</button>
              </div>
              <div className="fd-document">
                <span className="fd-step-icon fd-step-0"><FileText size={21} /></span><div><strong>{lesson.source}</strong><small>Guía de Fontex · {lesson.pages.length} páginas</small></div>
                <button className="fd-secondary" disabled={viewerBusy} onClick={() => void openSource(lesson.id, 1)} type="button">Abrir guía <ArrowRight size={15} /></button>
              </div>
              {material && (
                <div className="fd-document">
                  <span className="fd-step-icon fd-step-1"><FileText size={21} /></span><div><strong>{material.title}</strong><small>PDF añadido · {material.pages.length} pág.</small></div>
                  <button className="fd-secondary" disabled={viewerBusy} onClick={() => void openSource(material.id, 1)} type="button">Abrir PDF <ArrowRight size={15} /></button>
                  <button aria-label="Quitar PDF añadido" className="fd-icon-button" disabled={materialBusy} onClick={() => void removeMaterial()} type="button"><Trash2 size={17} /></button>
                </div>
              )}
              <p className="fd-footnote"><LockKeyhole size={15} /> Un PDF añadido por curso, hasta 5 MiB y 100 páginas. Se procesa y guarda en este navegador.</p>
            </section>
          )}

          {section === "tutor" && (
            <section className="fd-panel fd-content-panel fd-tutor" aria-labelledby="fd-consulta">
              <div className="fd-panel-head fd-flex"><div><p className="fd-kicker">CONSULTA DOCUMENTAL</p><h2 id="fd-consulta">Pregunta sobre tus lecturas</h2></div><span className="fd-badge"><i /> Búsqueda local</span></div>
              <p className="fd-support">El tutor busca coincidencias en el texto y muestra citas. Usa palabras del tema para encontrar mejores fragmentos.</p>
              <div className="fd-suggestions" aria-label="Ejemplos de preguntas">
                <button className="fd-cite" disabled={materialBusy} onClick={() => ask(lesson.prompt)} type="button"><Lightbulb size={15} /> {lesson.prompt}</button>
                <button className="fd-cite" disabled={materialBusy} onClick={() => ask("¿Quién ganó el mundial de fútbol?")} type="button"><CircleHelp size={15} /> Probar una pregunta fuera del tema</button>
              </div>
              {progress.exchanges.length > 0 && (
                <ol aria-label="Historial de consultas" aria-live="polite" className="fd-history">
                  {[...progress.exchanges].reverse().map(({ question: asked, citation }, index) => (
                    <li key={progress.exchanges.length - index}>
                      <p className="fd-question"><strong>Tú</strong><span>{asked}</span></p>
                      <div className="fd-answer"><p className="fd-answer-label"><MessageSquareText size={16} /> Fontex</p>
                        {citation ? <><blockquote>{citation.excerpt}</blockquote>{cite(citation)}</> : <p>No encontré un fragmento suficientemente relacionado en los materiales de este curso. Prueba con términos de la lectura o añade un PDF pertinente.</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <form className="fd-ask" onSubmit={(event) => { event.preventDefault(); ask(question); }}>
                <label className="sr-only" htmlFor="fd-question">Tu pregunta</label>
                <input id="fd-question" maxLength={240} onChange={(event) => setQuestion(event.target.value)} placeholder="Escribe tu pregunta sobre el tema…" value={question} />
                <button aria-label="Enviar pregunta" className="fd-button" disabled={!question.trim() || materialBusy} type="submit"><Send size={17} /> <span>Preguntar</span></button>
              </form>
              {progress.exchanges.length > 0 && <button className="fd-back fd-clear" onClick={() => updateProgress({ ...progress, exchanges: [] })} type="button"><Trash2 size={15} /> Borrar historial</button>}
            </section>
          )}

          {section === "practica" && (
            <>
              <section className="fd-panel fd-score" aria-label="Resultado de la práctica">
                <span className="fd-step-icon fd-step-0"><ClipboardList size={21} /></span>
                <div><strong>{answered} de {lesson.questions.length} resueltos</strong><small>{correct} {correct === 1 ? "acierto" : "aciertos"} · avance guardado en este navegador</small></div>
                {answered > 0 && <button className="fd-secondary" onClick={() => { updateProgress({ ...progress, answers: {} }); setSelected({}); setHints([]); }} type="button">Reiniciar</button>}
              </section>
              {lesson.questions.map((item, index) => {
                const answer = progress.answers[index];
                return (
                  <form className="fd-panel fd-exercise" key={`${lesson.id}-${index}`} onSubmit={(event) => checkAnswer(index, event)}>
                    <fieldset disabled={answer !== undefined}>
                      <legend><span>0{index + 1}</span>{item.text}</legend>
                      {item.options.map((option, optionIndex) => (
                        <label className="fd-option" key={option}>
                          <input checked={(answer ?? selected[index]) === optionIndex} name={`exercise-${index}`} onChange={() => setSelected({ ...selected, [index]: optionIndex })} type="radio" />
                          {option}
                          {answer !== undefined && optionIndex === item.correct && <Check size={17} />}
                        </label>
                      ))}
                    </fieldset>
                    {answer === undefined ? (
                      <>
                        <div className="fd-exercise-actions">
                          <button aria-expanded={hints.includes(index)} className="fd-secondary" onClick={() => setHints(hints.includes(index) ? hints.filter((value) => value !== index) : [...hints, index])} type="button"><Lightbulb size={16} /> Pista</button>
                          <button className="fd-button" disabled={selected[index] === undefined} type="submit">Comprobar</button>
                        </div>
                        {hints.includes(index) && <p className="fd-hint"><Lightbulb size={16} /> {item.hint}</p>}
                      </>
                    ) : (
                      <div className={`fd-feedback ${answer === item.correct ? "fd-good" : ""}`} role="status">
                        <p><strong>{answer === item.correct ? "Correcto." : "Revisa el cálculo."}</strong> {item.feedback}</p>
                        <button className="fd-cite" disabled={viewerBusy} onClick={() => void openSource(lesson.id, item.page)} type="button"><FileText size={15} /> Ver guía · p. {item.page} <ArrowRight size={14} /></button>
                      </div>
                    )}
                  </form>
                );
              })}
            </>
          )}

          <footer className="fd-footer"><span>Fontex · Aula de práctica</span><span><LockKeyhole size={13} /> Datos de demostración en este navegador</span></footer>
        </main>
      </div>
      {viewer && <PdfViewer blob={viewer.blob} document={viewer.document} initialPage={viewer.page} onClose={() => { setViewer(null); window.requestAnimationFrame(() => sourceTrigger.current?.focus()); }} />}
    </div>
  );
}
