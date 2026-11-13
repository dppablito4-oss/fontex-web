import { ProductLinks } from "../../components/ProductNavigation";
import {
  ArrowRight, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, ClipboardList,
  Divide, FileText, Hash, LayoutGrid, LibraryBig, Lightbulb, LoaderCircle,
  MessageSquareText, Percent, Plus, Sigma, Trash2, TrendingUp,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { BrandMark } from "../../components/BrandMark";
import { ThemeToggle } from "../theme/ThemeToggle";
import { PdfViewer } from "../library/components/PdfViewer";
import { AcademicMarkdown } from "../tutor/components/AcademicMarkdown";
import { type Citation, type DemoMaterial, type Exchange, type TutorConnection, findCitation, indexMaterial, readMaterials, requestTutor, tutorAvailable, writeMaterial } from "./demoService";
import lessons from "../../../supabase/functions/_shared/practice/lessons.json";
import { type TutorMode, trustedResources } from "../../../supabase/functions/_shared/practice/models";
import "./demo.css";
import { availableGrades, gradeLabel, lessonLevel, lessonLevels, type LessonLevel } from "./lesson-catalog";

const sections = [
  { id: "aula", label: "Inicio", icon: LayoutGrid },
  { id: "teoria", label: "Teoría", icon: BookOpen },
  { id: "biblioteca", label: "Biblioteca", icon: LibraryBig },
  { id: "tutor", label: "Tutor", icon: MessageSquareText },
  { id: "practica", label: "Práctica", icon: ClipboardList },
] as const;

type Section = (typeof sections)[number]["id"];
type Progress = { answers: Record<number, number>; exchanges: Exchange[] };
type Saved = { lessonId: string; progress: Record<string, Progress> };
type Viewer = { document: { title: string; originalFilename: string }; blob: Blob; page: number };

const guestStorageKey = "fontex-tutor-matematica-v1";
const defaultLesson = lessons[0]!;
const tutorModes = [
  { id: "study", label: "Mis archivos" },
  { id: "web", label: "Buscar en la web" },
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

const topicIcons: Record<string, typeof Divide> = {
  fracciones: Divide,
  decimales: Hash,
  proporciones: Percent,
  funciones: TrendingUp,
};

const sectionHeadings = {
  aula: "Tu tutor de Matemática",
  teoria: "Teoría y ejemplos",
  biblioteca: "Biblioteca",
  tutor: "Tutor",
  practica: "Práctica guiada",
};

export function DemoPage() {
  const { status, user } = useAuth();
  return <DemoWorkspace key={user?.id ?? "guest"} accountId={user?.id} authStatus={status} />;
}

function DemoWorkspace({ accountId, authStatus }: { accountId?: string; authStatus: ReturnType<typeof useAuth>["status"] }) {
  const storageKey = accountId ? `${guestStorageKey}:${accountId}` : guestStorageKey;
  const [saved, setSaved] = useState(() => readProgress(storageKey));
  const savedRef = useRef(saved);
  const [section, setSection] = useState<Section>("aula");
  const [level, setLevel] = useState<LessonLevel>(() => {
    const requested = new URLSearchParams(window.location.hash.split("?")[1]).get("nivel");
    return requested && Object.hasOwn(lessonLevels, requested) ? requested as LessonLevel : lessonLevel(saved.lessonId);
  });
  const [grade, setGrade] = useState<number | "all">("all");
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
  const exerciseFocus = useRef<HTMLFormElement>(null);
  const sourceTrigger = useRef<HTMLElement | null>(null);

  const lesson = lessons.find(({ id }) => id === saved.lessonId) ?? defaultLesson;
  const progress = saved.progress[lesson.id] ?? emptyProgress;
  const material = materials[lesson.id];
  const answered = Object.keys(progress.answers).length;
  const correct = lesson.questions.filter((item, i) => item.correct === progress.answers[i]).length;
  const currentExchanges = progress.exchanges.filter((item) => (item.mode ?? "study") === tutorMode);
  const connected = connection === "local" || (connection === "supabase" && authStatus === "authenticated");
  const canAsk = !pendingTutor && !materialBusy && (connected || tutorMode === "study");
  const activeQuestion = lesson.questions[activeExercise]!;
  const activeAnswer = progress.answers[activeExercise];
  const coachText = coach[`${lesson.id}:${activeExercise}:${activeAnswer}`];
  const theoryPage = lesson.pages.find((page) => page.pageNumber === activeQuestion?.page);
  const mistake = activeAnswer !== undefined && activeAnswer !== activeQuestion.correct;
  const catalogLessons = lessons.filter(item => item.level === level && (grade === "all" || item.grades.includes(grade)));
  const featuredLesson = catalogLessons.find(item => item.id === lesson.id) ?? catalogLessons[0]!;
  const featuredAnswered = Object.keys(saved.progress[featuredLesson.id]?.answers ?? {}).length;

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

  function goToExercise(index: number) {
    setActiveExercise(index);
    window.requestAnimationFrame(() => exerciseFocus.current?.focus());
  }

  function continueLesson() {
    if (!answered) {
      navigate("teoria");
      return;
    }
    const nextExercise = lesson.questions.findIndex((_, index) => progress.answers[index] === undefined);
    if (nextExercise >= 0) setActiveExercise(nextExercise);
    navigate("practica");
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
        <a className="fd-brand" href="#/" aria-label="Fontex, presentación"><BrandMark /></a>
        <p className="fd-area-caption">GUÍAS Y PRÁCTICA</p>
        <nav className="fd-nav" aria-label="Secciones">
          {sections.map(({ id, label, icon: Icon }) => (
            <button aria-current={section === id ? "page" : undefined} className="fd-nav-button" key={id} onClick={() => navigate(id)} type="button">
              <Icon size={19} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="fd-workspace" inert={Boolean(viewer)}>
        <header className="fd-top">
          <span className="fd-mobile-brand"><BrandMark /></span>
          <ProductLinks current="aprender" />
          <div className="fd-top-actions">
            {authStatus === "anonymous" && <a className="fd-text-button" href="#/ingresar-tutor">Iniciar sesión</a>}
            {authStatus === "authenticated" && <a className="fd-text-button" href="#/inicio">Mi cuenta</a>}
            <ThemeToggle />
          </div>
        </header>
        <main className={`fd-main fd-page-${section}`}>
          <header className="fd-intro">
            {section !== "aula" && <p className="fd-topic-context">{lesson.title} <span>·</span> {lesson.grade} · {lessonLevels[lessonLevel(lesson.id)]}</p>}
            <h1 ref={heading} tabIndex={-1}>{sectionHeadings[section]}</h1>
          </header>

          {section === "aula" && (
            <>
              <section className="fd-hero" aria-labelledby="lesson-title">
                <div className="fd-hero-copy">
                  <h2 id="lesson-title">{featuredLesson.title}</h2>
                  <p>{featuredLesson.description}</p>
                  <div className="fd-hero-actions">
                    <button className="fd-button" onClick={() => featuredLesson.id === lesson.id ? continueLesson() : selectLesson(featuredLesson.id)} type="button">
                      {featuredAnswered === featuredLesson.questions.length ? "Ver práctica" : featuredAnswered ? "Continuar práctica" : "Empezar tema"} <ArrowRight size={17} />
                    </button>
                    {featuredAnswered > 0 && <span>{featuredAnswered} de {featuredLesson.questions.length} resueltos</span>}
                  </div>
                </div>
                <div className="fd-hero-mark" aria-hidden="true">
                  <svg viewBox="0 0 160 160" fill="none">
                    <path d="M80 9a71 71 0 1 0 71 71H80Z" fill="currentColor" opacity=".12" />
                    <path d="M87 9v64h64A71 71 0 0 0 87 9Z" fill="currentColor" opacity=".52" />
                    <circle cx="80" cy="80" r="71" stroke="currentColor" strokeWidth="1.5" opacity=".44" />
                    <path d="M80 80v71m0-71H9" stroke="currentColor" strokeWidth="1.5" opacity=".34" />
                  </svg>
                </div>
              </section>
              <section className="fd-topics" aria-labelledby="fd-topics">
                <div className="fd-flex">
                <h2 id="fd-topics">Temas</h2>
                  <div className="fd-segment" role="group" aria-label="Nivel educativo">
                    {Object.entries(lessonLevels).map(([value, label]) => <button key={value} aria-pressed={level === value} onClick={() => { setLevel(value as LessonLevel); setGrade("all"); }} type="button">{label}</button>)}
                  </div>
                </div>
                <div className="fd-catalog-filter">
                  <label>Grado o etapa<select value={grade} onChange={event => setGrade(event.target.value === "all" ? "all" : Number(event.target.value))}>
                    <option value="all">Todos</option>{availableGrades(level).map(value => <option key={value} value={value}>{gradeLabel(level, value)}</option>)}
                  </select></label>
                  <p>Guías introductorias de Matemática; no cubren el currículo completo de cada grado.{level === "inicial" ? " Actividades con acompañamiento de una persona adulta." : ""}</p>
                </div>
                <div className="fd-topic-grid">
                  {catalogLessons.map((item) => {
                    const Icon = topicIcons[item.id] ?? (item.level === "inicial" ? Hash : Sigma);
                    return (
                      <button className="fd-topic" key={item.id} onClick={() => selectLesson(item.id)} type="button">
                        <span className="fd-symbol"><Icon size={19} aria-hidden="true" /></span>
                        <span><strong>{item.title}</strong><small>{item.grade} · {lessonLevels[lessonLevel(item.id)]} · {item.questions.length} ejercicios</small></span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {notice && <p className={`fd-notice ${notice.error ? "fd-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
          {storageError && <p className="fd-notice fd-error" role="alert">El navegador bloqueó el guardado del avance. Puedes continuar en esta pestaña.</p>}

          {section === "teoria" && (
            <div className="fd-theory-list">
              {lesson.pages.map((page) => (
                <section className="fd-panel fd-theory" key={page.pageNumber}>
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
              <div className="fd-flex"><h2 id="fd-materials">Materiales del tema</h2>
                <input accept=".pdf,application/pdf" aria-label="Seleccionar PDF" hidden onChange={(event) => void upload(event)} ref={fileInput} type="file" />
                <button className="fd-button" disabled={materialBusy} onClick={() => fileInput.current?.click()} type="button">{materialBusy ? <LoaderCircle className="fd-spin" size={17} /> : <Plus size={17} />} {material ? "Reemplazar PDF" : "Añadir PDF"}</button>
              </div>
              <div className="fd-document">
                <span className="fd-symbol"><FileText size={21} /></span><div><strong>{lesson.source}</strong><small>Guía de Fontex · {lesson.pages.length} páginas</small></div>
                <button className="fd-secondary" disabled={viewerBusy} onClick={() => void openSource(lesson.id, 1)} type="button">Abrir guía <ArrowRight size={15} /></button>
              </div>
              {material && (
                <div className="fd-document">
                  <span className="fd-symbol"><FileText size={21} /></span><div><strong>{material.title}</strong><small>PDF añadido · {material.pages.length} pág.</small></div>
                  <button className="fd-secondary" disabled={viewerBusy} onClick={() => void openSource(material.id, 1)} type="button">Abrir PDF <ArrowRight size={15} /></button>
                  <button aria-label="Quitar PDF añadido" className="fd-icon-button" disabled={materialBusy} onClick={() => void removeMaterial()} type="button"><Trash2 size={17} /></button>
                </div>
              )}
              <p className="fd-footnote">Puedes añadir un PDF de hasta 5 MB y 100 páginas por tema.</p>
            </section>
          )}

          {section === "tutor" && (
            <section className="fd-panel fd-tutor" aria-label="Conversación con el tutor">
              <div className="fd-tutor-bar">
                <div className="fd-segment" role="group" aria-label="Fuentes de la respuesta">
                  {tutorModes.map(({ id, label }) => (
                    <button aria-pressed={tutorMode === id} key={id} onClick={() => { setTutorMode(id); setQuestion(""); }} type="button">{label}</button>
                  ))}
                </div>
              </div>

              {currentExchanges.length === 0 && (
                <div className="fd-tutor-empty">
                  <span className="fd-symbol"><MessageSquareText size={22} aria-hidden="true" /></span>
                  <h2>{tutorMode === "study" ? "Pregunta sobre tus lecturas" : tutorMode === "web" ? "Explora fuentes educativas" : "Conversa con tu tutor"}</h2>
                  {tutorMode === "study" && <button className="fd-cite" disabled={!canAsk} onClick={() => ask(lesson.prompt)} type="button">{lesson.prompt} <ArrowRight size={15} /></button>}
                </div>
              )}

              {!connected && tutorMode !== "study" && (
                <div className="fd-tutor-availability">
                  {authStatus === "anonymous"
                    ? <a className="fd-text-button" href="#/ingresar-tutor">Inicia sesión para hacer una consulta <ArrowRight size={15} /></a>
                    : <p>El tutor no está disponible en este momento.</p>}
                  {tutorMode === "web" && trustedResources.map(({ title, url }) => <a className="fd-cite" href={url} key={url} rel="noreferrer" target="_blank">{title} <ArrowRight size={15} /></a>)}
                </div>
              )}

              {currentExchanges.length > 0 && (
                <ol aria-label="Historial de consultas" aria-live="polite" className="fd-history">
                  {[...currentExchanges].reverse().map(({ id, question: asked, citation, reply }, index) => (
                    <li key={id ?? `local-${index}`}>
                      <p className="fd-question">{asked}</p>
                      <div className="fd-answer">
                        <p className="fd-answer-label">Fontex</p>
                        {reply && <AcademicMarkdown content={reply.text} />}
                        {citation && <>{!reply && <blockquote>{citation.excerpt}</blockquote>}{cite(citation)}</>}
                        {reply?.sources.map(({ title, url }) => <a className="fd-cite fd-web-source" href={url} key={url} rel="noreferrer" target="_blank">{title} <ArrowRight size={15} /></a>)}
                        {!reply && !citation && <p>{tutorMode === "study" ? "No encontré una respuesta en los materiales de este tema. Prueba con otra pregunta o añade una lectura." : pendingTutor && index === 0 ? "Preparando una respuesta…" : "No pude responder esa pregunta. Inténtalo de nuevo."}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {pendingTutor && <p className="sr-only" role="status">El tutor está preparando una respuesta.</p>}
              <form className="fd-ask" onSubmit={(event) => { event.preventDefault(); ask(question); }}>
                <label className="sr-only" htmlFor="fd-question">Tu pregunta</label>
                <input disabled={!connected && tutorMode !== "study"} id="fd-question" maxLength={240} onChange={(event) => setQuestion(event.target.value)} placeholder="Escribe tu pregunta…" value={question} />
                <button aria-label="Enviar pregunta" className="fd-button" disabled={!question.trim() || !canAsk} type="submit"><ArrowUp size={19} /></button>
              </form>
              {currentExchanges.length > 0 && <button className="fd-text-button fd-clear" onClick={() => updateProgress({ ...progress, exchanges: progress.exchanges.filter((item) => (item.mode ?? "study") !== tutorMode) })} type="button">Borrar conversación</button>}
            </section>
          )}

          {section === "practica" && (
            <>
              <div className="fd-practice-progress">
                <span>{answered} de {lesson.questions.length} resueltos</span>
                <progress aria-label="Ejercicios resueltos" max={lesson.questions.length} value={answered} />
                <span>{correct} {correct === 1 ? "acierto" : "aciertos"}</span>
              </div>
              <div className="fd-practice-grid">
                <form aria-label="Ejercicio actual" className="fd-panel fd-exercise" onSubmit={(event) => checkAnswer(activeExercise, event)} ref={exerciseFocus} tabIndex={-1}>
                  <div className="fd-exercise-top">
                    <span>Ejercicio {activeExercise + 1} de {lesson.questions.length}</span>
                    <div role="group" aria-label="Cambiar de ejercicio">
                      <button aria-label="Ejercicio anterior" className="fd-icon-button" disabled={activeExercise === 0} onClick={() => goToExercise(activeExercise - 1)} type="button"><ChevronLeft size={18} /></button>
                      <button aria-label="Ejercicio siguiente" className="fd-icon-button" disabled={activeExercise + 1 >= lesson.questions.length} onClick={() => goToExercise(activeExercise + 1)} type="button"><ChevronRight size={18} /></button>
                    </div>
                  </div>
                  <fieldset disabled={activeAnswer !== undefined}>
                    <legend>{activeQuestion.text}</legend>
                    {activeQuestion.options.map((option, optionIndex) => (
                      <label className="fd-option" key={option}>
                        <input checked={(activeAnswer ?? selected[activeExercise]) === optionIndex} name={`exercise-${activeExercise}`} onChange={() => setSelected({ ...selected, [activeExercise]: optionIndex })} type="radio" />
                        <span>{option}</span>
                        {activeAnswer !== undefined && optionIndex === activeQuestion.correct && <Check size={17} aria-label="Respuesta correcta" />}
                      </label>
                    ))}
                  </fieldset>
                  {hints.includes(activeExercise) && activeAnswer === undefined && <p className="fd-hint"><Lightbulb size={16} /> {activeQuestion.hint}</p>}
                  {activeAnswer !== undefined && (
                    <div className={`fd-feedback ${mistake ? "" : "fd-good"}`} role="status">
                      <p><strong>{mistake ? "Veamos dónde te confundiste." : "Correcto."}</strong> {mistake ? activeQuestion.misconceptions[activeAnswer] : activeQuestion.feedback}</p>
                      {mistake && <p>{activeQuestion.feedback}</p>}
                      {mistake && coachText && <p><strong>Del tutor.</strong> {coachText}</p>}
                      {mistake && theoryPage && (
                        <div className="fd-inline-theory">
                          <strong>{theoryPage.heading}</strong>
                          <p>{theoryPage.text}</p>
                          {cite({ sourceId: lesson.id, title: lesson.source, page: theoryPage.pageNumber, excerpt: theoryPage.text })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="fd-exercise-actions">
                    {activeAnswer === undefined ? (
                      <>
                        <button aria-expanded={hints.includes(activeExercise)} className="fd-text-button" onClick={() => setHints(hints.includes(activeExercise) ? hints.filter((value) => value !== activeExercise) : [...hints, activeExercise])} type="button"><Lightbulb size={16} /> Pista</button>
                        <button className="fd-button" disabled={selected[activeExercise] === undefined} type="submit">Comprobar</button>
                      </>
                    ) : mistake ? (
                      <button className="fd-button" onClick={() => { retry(activeExercise); goToExercise(activeExercise); }} type="button">Volver a intentarlo</button>
                    ) : activeExercise + 1 < lesson.questions.length ? (
                      <button className="fd-button" onClick={() => goToExercise(activeExercise + 1)} type="button">Siguiente ejercicio <ArrowRight size={16} /></button>
                    ) : (
                      <button className="fd-button" onClick={() => navigate("aula")} type="button">Volver al inicio</button>
                    )}
                  </div>
                </form>
                {theoryPage && (
                  <aside aria-label="Teoría del ejercicio" className="fd-panel fd-practice-theory">
                    <p className="fd-kicker">{mistake ? "CONCEPTO PARA REPASAR" : "TEORÍA DEL EJERCICIO"}</p>
                    <h2>{theoryPage.heading}</h2>
                    <p className="fd-theory-text">{theoryPage.text}</p>
                    {cite({ sourceId: lesson.id, title: lesson.source, page: theoryPage.pageNumber, excerpt: theoryPage.text })}
                  </aside>
                )}
              </div>
              {answered > 0 && <button className="fd-text-button fd-clear" onClick={() => { updateProgress({ ...progress, answers: {} }); setSelected({}); setHints([]); goToExercise(0); }} type="button">Reiniciar práctica</button>}
            </>
          )}
        </main>
      </div>
      {viewer && <PdfViewer blob={viewer.blob} document={viewer.document} initialPage={viewer.page} onClose={() => { setViewer(null); window.requestAnimationFrame(() => sourceTrigger.current?.focus()); }} />}
    </div>
  );
}
