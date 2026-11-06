import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp,
  ClipboardList, FileText, GraduationCap, LayoutGrid, LibraryBig, Lightbulb, LoaderCircle,
  LockKeyhole, MessageSquareText, Plus, Send, Sigma, Trash2,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { BrandMark } from "../../components/BrandMark";
import { PdfViewer } from "../library/components/PdfViewer";
import { type Citation, type DemoMaterial, type Exchange, type TutorConnection, findCitation, indexMaterial, readMaterials, requestTutor, tutorAvailable, writeMaterial } from "./demoService";
import lessons from "../../../supabase/functions/_shared/practice/lessons.json";
import { type TutorMode, trustedDomains, trustedResources, tutorModels } from "../../../supabase/functions/_shared/practice/models";
import "./demo.css";

const sections = [
  { id: "aula", label: "Mi aula", icon: LayoutGrid },
  { id: "teoria", label: "Teoría", icon: BookOpen },
  { id: "biblioteca", label: "Biblioteca", icon: LibraryBig },
  { id: "tutor", label: "Tutor", icon: MessageSquareText },
  { id: "practica", label: "Práctica", icon: ClipboardList },
] as const;

type Section = (typeof sections)[number]["id"];
type Level = "primaria" | "secundaria";
type Progress = { answers: Record<number, number>; exchanges: Exchange[] };
type Saved = { lessonId: string; progress: Record<string, Progress> };
type Viewer = { document: { title: string; originalFilename: string }; blob: Blob; page: number };

const guestStorageKey = "fontex-tutor-matematica-v1";
const defaultLesson = lessons[0]!;
const tutorModes = [
  { id: "study", label: "Estudiar con mis archivos" },
  { id: "web", label: "Sitios confiables" },
  { id: "chat", label: "Chat general" },
] as const;

const emptyProgress: Progress = { answers: {}, exchanges: [] };

function readProgress(storageKey: string): Saved {
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
  const { status, user } = useAuth();
  return <DemoWorkspace key={user?.id ?? "guest"} accountId={user?.id} authStatus={status} />;
}

function DemoWorkspace({ accountId, authStatus }: { accountId?: string; authStatus: ReturnType<typeof useAuth>["status"] }) {
  const storageKey = accountId ? `${guestStorageKey}:${accountId}` : guestStorageKey;
  const [saved, setSaved] = useState(() => readProgress(storageKey));
  const savedRef = useRef(saved);
  const [section, setSection] = useState<Section>("aula");
  const [level, setLevel] = useState<Level>(saved.lessonId === "funciones" || saved.lessonId === "proporciones" ? "secundaria" : "primaria");
  const [activeExercise, setActiveExercise] = useState(0);
  const [coach, setCoach] = useState<Record<string, string>>({});
  const [connection, setConnection] = useState<TutorConnection | null>(null);
  const [tutorMode, setTutorMode] = useState<TutorMode>("study");
  const [pendingTutor, setPendingTutor] = useState(false);
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
  const currentExchanges = progress.exchanges.filter((item) => (item.mode ?? "study") === tutorMode);
  const selectedModel = tutorMode === "chat" ? tutorModels.chat : tutorModels.study;
  const connected = connection === "local" || (connection === "supabase" && authStatus === "authenticated");
  const canAsk = !pendingTutor && !materialBusy && (connected || tutorMode === "study");
  const activeQuestion = lesson.questions[activeExercise];
  const theoryPage = lesson.pages.find((page) => page.pageNumber === activeQuestion?.page);
  const mistake = activeQuestion && progress.answers[activeExercise] !== undefined && progress.answers[activeExercise] !== activeQuestion.correct;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Fontex · Tu tutor de Matemática";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    let active = true;
    void tutorAvailable(authStatus === "authenticated").then((value) => {
      if (active) setConnection(value);
    }).catch(() => {
      if (active) setConnection(null);
    });
    return () => { active = false; };
  }, [authStatus]);

  useEffect(() => {
    let active = true;
    void readMaterials(accountId).then((data) => {
      if (active) setMaterials(data);
    }).catch(() => {
      if (active) setNotice({ text: "El navegador bloqueó el acceso a los PDF guardados.", error: true });
    }).finally(() => {
      if (active) setMaterialBusy(false);
    });
    return () => { active = false; };
  }, [accountId]);

  function save(next: Saved) {
    savedRef.current = next;
    setSaved(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setStorageError(true);
    }
  }

  function updateProgress(next: Progress, topic = lesson.id) {
    const current = savedRef.current;
    save({ ...current, progress: { ...current.progress, [topic]: next } });
  }

  function navigate(next: Section) {
    setSection(next);
    setNotice(null);
    window.scrollTo(0, 0);
    window.requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  function selectLesson(id: string) {
    if (id !== lesson.id) {
      save({ ...saved, lessonId: id });
      setQuestion("");
      setHints([]);
      setSelected({});
      setActiveExercise(0);

    }
    navigate("teoria");
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setMaterialBusy(true);
    setNotice(null);
    try {
      const next = await indexMaterial(file);
      await writeMaterial(lesson.id, next, accountId);
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
      await writeMaterial(lesson.id, undefined, accountId);
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
    const text = value.trim();
    if (!text || !canAsk) return;
    setNotice(null);
    const citation = tutorMode === "study" ? findCitation(text, lesson, material) : null;
    const exchange: Exchange = { id: crypto.randomUUID(), question: text, citation, mode: tutorMode };
    updateProgress({ ...progress, exchanges: [...progress.exchanges, exchange].slice(-20) });
    setQuestion("");
    if (!connected || !connection || (tutorMode === "study" && !citation)) return;
    setPendingTutor(true);
    void requestTutor({
      mode: tutorMode,
      topic: lesson.id,
      question: text,
      evidence: citation?.excerpt,
      history: currentExchanges.flatMap(({ question: previous, reply }) => reply ? [`Alumno: ${previous}`, `Tutor: ${reply.text}`] : []),
    }, connection).then((reply) => {
      const latest = savedRef.current.progress[lesson.id];
      if (!latest?.exchanges.some(({ id }) => id === exchange.id)) return;
      updateProgress({ ...latest, exchanges: latest.exchanges.map((item) => item.id === exchange.id ? { ...item, reply } : item) }, lesson.id);
    }).catch((error: unknown) => {
      setNotice({ text: error instanceof Error ? error.message : "No se pudo conectar con el tutor.", error: true });
    }).finally(() => setPendingTutor(false));
  }

  function checkAnswer(index: number, event: FormEvent) {
    event.preventDefault();
    const answer = selected[index];
    if (answer === undefined || progress.answers[index] !== undefined) return;
    updateProgress({ ...progress, answers: { ...progress.answers, [index]: answer } });
    setActiveExercise(index);
    if (connected && connection && answer !== lesson.questions[index]?.correct) {
      const key = `${lesson.id}:${index}:${answer}`;
      if (!coach[key]) {
        void requestTutor({ mode: "study", topic: lesson.id, exercise: index, answer }, connection).then((reply) => {
          setCoach((previous) => ({ ...previous, [key]: reply.text }));
        }).catch((error: unknown) => {
          setNotice({ text: error instanceof Error ? error.message : "No se pudo conectar con el tutor.", error: true });
        });
      }
    }
  }

  function retry(index: number) {
    const answers = { ...progress.answers };
    const nextSelected = { ...selected };
    delete answers[index];
    delete nextSelected[index];
    setSelected(nextSelected);
    updateProgress({ ...progress, answers });
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
        <p className="fd-nav-label fd-course-label">TEMA ACTIVO</p>
        <div className="fd-current"><Sigma size={18} /><div><strong>{lesson.title}</strong><small>{lesson.grade} de {lesson.level}</small></div></div>
        <div className="fd-side-bottom"><span><GraduationCap size={20} /></span><div><strong>{accountId ? "Tu cuenta Fontex" : "Estudiante demo"}</strong><small>{accountId ? "Sesión iniciada" : "Sesión local"}</small></div></div>
      </aside>
      <div className="fd-workspace" inert={Boolean(viewer)}>
        <header className="fd-top">
          <div className="fd-crumb"><span>Aprendizaje individual</span><ChevronRight size={14} /><strong>Matemática</strong></div>
          {authStatus === "anonymous" && !connected
            ? <a className="fd-secondary" href="#/ingresar-tutor">Iniciar sesión para usar IA</a>
            : <span className="fd-badge"><i /> {connected ? "IA conectada" : "Práctica local"}</span>}
        </header>
        <main className="fd-main">
          {section === "aula" ? (
            <>
              <div className="fd-intro"><p className="fd-kicker"><Sigma size={16} /> APRENDIZAJE INDIVIDUAL</p><h1 ref={heading} tabIndex={-1}>Tu tutor de Matemática</h1><p>Elige qué estudiar. Repasa la teoría, practica y recibe ayuda cuando te equivoques.</p></div>
              <section className="fd-hero" aria-labelledby="lesson-title">
                <HeroArt />
                <div className="fd-hero-copy">
                  <span className="fd-hero-label"><span /> TU TEMA ACTUAL · {lesson.grade} DE {lesson.level.toUpperCase()}</span>
                  <h2 id="lesson-title">{lesson.title}</h2>
                  <p>{lesson.description}</p>
                  <button className="fd-button fd-button-light" onClick={() => navigate("teoria")} type="button">Leer teoría <ArrowRight size={17} /></button>
                </div>
              </section>
              <section className="fd-panel fd-topics" aria-labelledby="fd-topics">
                <div className="fd-panel-head fd-flex">
                  <div><p className="fd-kicker">CATÁLOGO</p><h2 id="fd-topics">Elige un tema</h2></div>
                  <div className="fd-levels" role="group" aria-label="Nivel educativo">
                    <button aria-pressed={level === "primaria"} className="fd-secondary" onClick={() => setLevel("primaria")} type="button">Primaria</button>
                    <button aria-pressed={level === "secundaria"} className="fd-secondary" onClick={() => setLevel("secundaria")} type="button">Secundaria</button>
                  </div>
                </div>
                <div className="fd-topic-grid">
                  {lessons.filter((item) => item.level === level).map((item) => (
                    <button className="fd-topic" key={item.id} onClick={() => selectLesson(item.id)} type="button">
                      <span className="fd-step-icon fd-step-0"><Sigma size={18} /></span>
                      <span><strong>{item.title}</strong><small>{item.grade} de {item.level} · {item.questions.length} ejercicios</small></span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              </section>
              <div className="fd-dashboard">
                <section className="fd-panel fd-steps" aria-labelledby="fd-steps">
                  <div className="fd-panel-head"><div><p className="fd-kicker">RECORRIDO</p><h2 id="fd-steps">Sigue esta ruta</h2></div></div>
                  {[
                    { id: "teoria", title: "Lee la teoría del tema", detail: "Explicaciones, ejemplos y guía PDF", icon: BookOpen },
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
                <p className="fd-kicker"><Sigma size={16} /> {lesson.grade} DE {lesson.level} · {lesson.title}</p>
                <h1 ref={heading} tabIndex={-1}>{section === "teoria" ? "Teoría y ejemplos" : section === "biblioteca" ? "Biblioteca del aula" : section === "tutor" ? "Tutor con fuentes" : "Práctica guiada"}</h1>
                <p>{section === "teoria" ? lesson.description : section === "biblioteca" ? "Abre la guía del tema o añade un PDF que puedas consultar aquí." : section === "tutor" ? "Escribe una pregunta y consulta el fragmento más relevante de tus lecturas." : "Resuelve a tu ritmo. Si fallas, tendrás la corrección y la teoría del ejercicio a la vista."}</p>
              </div>
            </>
          )}

          {notice && <p className={`fd-notice ${notice.error ? "fd-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
          {storageError && <p className="fd-notice fd-error" role="alert">El navegador bloqueó el guardado del avance. Puedes continuar en esta pestaña.</p>}

          {section === "teoria" && (
            <div className="fd-theory-list">
              {lesson.pages.map((page) => (
                <section className="fd-panel fd-theory" key={page.pageNumber}>
                  <p className="fd-kicker"><BookOpen size={16} /> PARTE {page.pageNumber}</p>
                  <h2>{page.heading}</h2>
                  <p className="fd-theory-text">{page.text}</p>
                  {cite({ sourceId: lesson.id, title: lesson.source, page: page.pageNumber, excerpt: page.text })}
                </section>
              ))}
              <button className="fd-button fd-start-practice" onClick={() => navigate("practica")} type="button">Pasar a los ejercicios <ArrowRight size={17} /></button>
            </div>
          )}

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
              <div className="fd-panel-head fd-flex"><div><p className="fd-kicker">TUTOR PERSONAL</p><h2 id="fd-consulta">Elige cómo conversar</h2></div><span className="fd-badge"><i /> {selectedModel.name}{connected ? "" : " · sin conectar"}</span></div>
              <div className="fd-modes" role="group" aria-label="Modo del tutor">
                {tutorModes.map(({ id, label }) => (
                  <button aria-pressed={tutorMode === id} className="fd-secondary" key={id} onClick={() => { setTutorMode(id); setQuestion(""); }} type="button">{label}</button>
                ))}
              </div>
              <p className="fd-support">{tutorMode === "study" ? (connected ? "Sol explica a partir del fragmento encontrado y muestra su página." : "Puedes buscar fragmentos y abrir sus páginas. Con la API conectada, Sol también explica a partir de la fuente.") : tutorMode === "web" ? `Sol consulta únicamente los dominios permitidos: ${trustedDomains.join(", ")}.` : "Luna ayuda a organizar el estudio y mantiene el contexto del chat."}</p>
              {tutorMode === "study" && (
                <div className="fd-suggestions" aria-label="Ejemplos de preguntas">
                  <button className="fd-cite" disabled={!canAsk} onClick={() => ask(lesson.prompt)} type="button"><Lightbulb size={15} /> {lesson.prompt}</button>
                  <button className="fd-cite" disabled={!canAsk} onClick={() => ask("¿Quién ganó el mundial de fútbol?")} type="button"><CircleHelp size={15} /> Probar una pregunta fuera del tema</button>
                </div>
              )}
              {!connected && tutorMode === "web" && (
                <div className="fd-suggestions" aria-label="Recursos educativos">
                  {trustedResources.map(({ title, url }) => <a className="fd-cite" href={url} key={url} rel="noreferrer" target="_blank">{title} <ArrowRight size={15} /></a>)}
                </div>
              )}
              {!connected && tutorMode !== "study" && <p className="fd-support">{authStatus === "anonymous" ? "Inicia sesión en Fontex para enviar preguntas en este modo." : authStatus === "authenticated" ? "El tutor de IA aún no está disponible. Intenta más tarde." : "Conecta el proyecto a Supabase o al servidor de desarrollo para enviar preguntas en este modo."}</p>}
              {currentExchanges.length > 0 && (
                <ol aria-label="Historial de consultas" aria-live="polite" className="fd-history">
                  {[...currentExchanges].reverse().map(({ id, question: asked, citation, reply }, index) => (
                    <li key={id ?? `local-${index}`}>
                      <p className="fd-question"><strong>Tú</strong><span>{asked}</span></p>
                      <div className="fd-answer"><p className="fd-answer-label"><MessageSquareText size={16} /> {reply ? selectedModel.name : "Fontex"}</p>
                        {reply && <p className="fd-tutor-text">{reply.text}</p>}
                        {citation && <><blockquote>{citation.excerpt}</blockquote>{cite(citation)}</>}
                        {reply?.sources.map(({ title, url }) => <a className="fd-cite fd-web-source" href={url} key={url} rel="noreferrer" target="_blank">{title} <ArrowRight size={15} /></a>)}
                        {!reply && !citation && <p>{tutorMode === "study" ? "No encontré un fragmento suficientemente relacionado en los materiales de este tema. Prueba con términos de la lectura o añade un PDF pertinente." : pendingTutor && index === 0 ? "Consultando…" : tutorMode === "web" ? "No obtuve una respuesta con referencias verificables en los sitios permitidos." : "No se pudo conectar con Luna. Inténtalo de nuevo."}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {pendingTutor && <p className="fd-support" role="status">{selectedModel.name} está preparando una respuesta…</p>}
              <form className="fd-ask" onSubmit={(event) => { event.preventDefault(); ask(question); }}>
                <label className="sr-only" htmlFor="fd-question">Tu pregunta</label>
                <input disabled={!connected && tutorMode !== "study"} id="fd-question" maxLength={240} onChange={(event) => setQuestion(event.target.value)} placeholder="Escribe tu pregunta…" value={question} />
                <button aria-label="Enviar pregunta" className="fd-button" disabled={!question.trim() || !canAsk} type="submit"><Send size={17} /> <span>Preguntar</span></button>
              </form>
              {currentExchanges.length > 0 && <button className="fd-back fd-clear" onClick={() => updateProgress({ ...progress, exchanges: progress.exchanges.filter((item) => (item.mode ?? "study") !== tutorMode) })} type="button"><Trash2 size={15} /> Borrar historial</button>}
            </section>
          )}

          {section === "practica" && (
            <>
              <section className="fd-panel fd-score" aria-label="Resultado de la práctica">
                <span className="fd-step-icon fd-step-0"><ClipboardList size={21} /></span>
                <div><strong>{answered} de {lesson.questions.length} resueltos</strong><small>{correct} {correct === 1 ? "acierto" : "aciertos"} · {connected ? tutorModels.study.name : "Corrección guiada local"}</small></div>
                {answered > 0 && <button className="fd-secondary" onClick={() => { updateProgress({ ...progress, answers: {} }); setSelected({}); setHints([]); }} type="button">Reiniciar</button>}
              </section>
              <div className="fd-practice-grid">
                <div>
              {lesson.questions.map((item, index) => {
                const answer = progress.answers[index];
                const coachText = coach[`${lesson.id}:${index}:${answer}`];
                const exerciseTheory = lesson.pages.find(({ pageNumber }) => pageNumber === item.page);
                return (
                  <form className="fd-panel fd-exercise" key={`${lesson.id}-${index}`} onFocus={() => setActiveExercise(index)} onSubmit={(event) => checkAnswer(index, event)}>
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
                        <p><strong>{answer === item.correct ? "Correcto." : "Veamos dónde te confundiste."}</strong> {answer === item.correct ? item.feedback : item.misconceptions[answer]}</p>
                        {answer !== item.correct && <p className="fd-worked">{item.feedback}</p>}
                        {answer !== item.correct && coachText && <p className="fd-worked"><strong>{tutorModels.study.name}.</strong> {coachText}</p>}
                        {answer !== item.correct && exerciseTheory && <div className="fd-inline-theory"><strong>{exerciseTheory.heading}</strong><p>{exerciseTheory.text}</p></div>}
                        <div className="fd-feedback-actions">
                          {answer !== item.correct && <button className="fd-cite" onClick={() => retry(index)} type="button">Volver a intentarlo <ArrowRight size={14} /></button>}
                          <button className="fd-cite" disabled={viewerBusy} onClick={() => void openSource(lesson.id, item.page)} type="button"><FileText size={15} /> Ver guía · p. {item.page} <ArrowRight size={14} /></button>
                        </div>
                      </div>
                    )}
                  </form>
                );
              })}
                </div>
                {theoryPage && (
                  <aside aria-label="Teoría del ejercicio" className="fd-panel fd-practice-theory">
                    <p className="fd-kicker"><BookOpen size={16} /> {mistake ? "REPASA ESTE CONCEPTO" : `TEORÍA · EJERCICIO ${activeExercise + 1}`}</p>
                    <h2>{theoryPage.heading}</h2>
                    <p className="fd-theory-text">{theoryPage.text}</p>
                    {cite({ sourceId: lesson.id, title: lesson.source, page: theoryPage.pageNumber, excerpt: theoryPage.text })}
                  </aside>
                )}
              </div>
            </>
          )}

          <footer className="fd-footer"><span>Fontex · Tutor personal de Matemática</span><span><LockKeyhole size={13} /> Datos de demostración en este navegador</span></footer>
        </main>
      </div>
      {viewer && <PdfViewer blob={viewer.blob} document={viewer.document} initialPage={viewer.page} onClose={() => { setViewer(null); window.requestAnimationFrame(() => sourceTrigger.current?.focus()); }} />}
    </div>
  );
}
