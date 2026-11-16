import { useEffect, useRef, useState } from "react";
import { PdfViewer } from "../library/components/PdfViewer";
import { CanvasReading } from "../primitives/CanvasReading";
import { CanvasDialog } from "../primitives/CanvasDialog";
import { SiteHeader } from "../../components/ProductNavigation";
import { ClassroomGuestBanner } from "./ClassroomGuestProvider";
import { useClassroomGuest } from "./classroom-guest-context";
import type { PrimitiveScene } from "../../core/primitives/schema";
import {
  classroomAction,
  listSubmissions,
  loadLesson,
  type Lesson,
  type Submission,
} from "./learning-service";
import { classroomClient } from "./classroom-access";
import "./classroom-learning.css";
export function LessonPage({ id }: { id: string }) {
  const { guest } = useClassroomGuest();
  const [lesson, setLesson] = useState<Lesson | null>(null),
    [scene, setScene] = useState<PrimitiveScene | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]),
    [selected, setSelected] = useState<Submission | null>(null),
    [feedback, setFeedback] = useState("");
  const [pdf, setPdf] = useState<{ blob: Blob; name: string } | null>(null);
  const [reload, setReload] = useState(0);
  const revision = useRef(0);
  useEffect(() => {
    let live = true;
    void loadLesson(id)
      .then(async (value) => {
        if (!live) return;
        setLesson(value);
        setScene(value.submission?.scene ?? value.scene);
        setDirty(false);
        setError("");
        if (value.teacher) {
          const all = await listSubmissions(id);
          if (live) setSubmissions(all);
        }
      })
      .catch((e) => {
        if (live)
          setError(
            e instanceof Error ? e.message : "No se pudo completar la acción.",
          );
      });
    return () => {
      live = false;
    };
  }, [id, guest?.token, reload]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(submit: boolean) {
    if (!scene || busy) return;
    setBusy(true);
    setError("");
    const current = revision.current;
    try {
      await classroomAction(id, "save", { scene, submit });
      if (current === revision.current) setDirty(false);
      setNotice(
        submit
          ? "Actividad entregada al docente."
          : "Borrador guardado en el aula.",
      );
      if (lesson)
        setLesson({ ...lesson, status: submit ? "submitted" : "draft" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function material(path: string, name: string) {
    setError("");
    try {
      const r = await classroomAction(id, "material", { path });
      if (!r.url) throw Error("Archivo no disponible.");
      const response = await fetch(r.url, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw Error("No se pudo descargar el PDF del aula.");
      setPdf({ blob: await response.blob(), name });
    } catch (e) {
      setError(String((e as Error).message));
    }
  }
  async function review() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await classroomClient().rpc("review_class_attempt", {
        p_submission: selected.id,
        p_feedback: feedback,
      });
      if (error) throw error;
      setSelected(null);
      setNotice("Devolución guardada para el estudiante.");
      setReload((v) => v + 1);
    } catch {
      setError("No se pudo guardar la devolución.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pc-app cl-page">
      <SiteHeader
        onNavigate={() =>
          !dirty ||
          window.confirm("Tienes respuestas sin guardar. ¿Salir de esta clase?")
        }
      />
      <ClassroomGuestBanner />
      <main className="cl-player">
        <a
          href="#/aula"
          onClick={(e) => {
            if (
              dirty &&
              !window.confirm("Tienes respuestas sin guardar. ¿Volver al aula?")
            )
              e.preventDefault();
          }}
        >
          ← Volver a mi aula
        </a>
        <h1>{lesson?.title || "Abrir clase"}</h1>
        {!lesson && !error && <p role="status">Cargando clase…</p>}
        {error && (
          <p className="cl-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="cl-status" role="status">
            {notice}
          </p>
        )}
        {lesson && scene && (
          <>
            <p className="cl-meta">
              Semana {lesson.week} · {lesson.class_date} · {lesson.topic}
              {lesson.due_at
                ? ` · Entrega: ${new Date(lesson.due_at).toLocaleString("es")}`
                : ""}
            </p>
            <p className="cl-instructions">{lesson.instructions}</p>
            <div className="cl-actions">
              {lesson.attachments.map((a) => (
                <button
                  key={a.path}
                  onClick={() => void material(a.path, a.name)}
                >
                  PDF · {a.name}
                </button>
              ))}
              <button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void import("../primitives/export-pdf")
                    .then((m) => m.exportCanvasPdf(scene, location.href))
                    .catch(() => setError("No se pudo generar el PDF."))
                    .finally(() => setBusy(false));
                }}
              >
                Descargar lienzo PDF
              </button>
              {lesson.teacher && (
                <button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void classroomAction(id, "notify")
                      .then((v) => setNotice(v.message ?? "Avisos procesados."))
                      .catch((e) =>
                        setError(
                          e instanceof Error
                            ? e.message
                            : "No se pudo completar la acción.",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Reintentar avisos por correo
                </button>
              )}
            </div>
            {!lesson.teacher && (
              <p className="cl-status">
                Escribe tus respuestas y ajusta los valores habilitados dentro
                del lienzo.{" "}
                {lesson.status === "submitted"
                  ? "Ya entregaste esta actividad; puedes corregirla y volver a entregar."
                  : lesson.status === "reviewed"
                    ? "Tu docente revisó la actividad."
                    : "Guarda tu avance antes de salir."}
              </p>
            )}
            {lesson.submission?.feedback && (
              <div className="cl-status">
                <strong>Devolución del docente</strong>
                <p className="cl-instructions">{lesson.submission.feedback}</p>
              </div>
            )}
            <CanvasReading
              scene={scene}
              practice={!lesson.teacher && !busy}
              onPracticeChange={(next) => {
                revision.current++;
                setScene(next);
                setDirty(true);
              }}
            />
            {!lesson.teacher && (
              <div className="cl-savebar cl-actions">
                <span>
                  {dirty
                    ? "Respuestas sin guardar"
                    : lesson.status === "submitted"
                      ? "Entregado"
                      : "Avance guardado"}
                </span>
                <button disabled={busy} onClick={() => void save(false)}>
                  Guardar borrador
                </button>
                <button disabled={busy} onClick={() => void save(true)}>
                  {busy ? "Guardando…" : "Entregar actividad"}
                </button>
              </div>
            )}
            {lesson.teacher && (
              <section className="cl-deliveries">
                <h2 className="section-title">
                  Entregas de la clase ·{" "}
                  {submissions.filter((s) => s.status !== "draft").length}
                </h2>
                {!submissions.length && (
                  <p>Todavía no hay respuestas guardadas.</p>
                )}
                {submissions.map((s) => (
                  <article className="cl-card" key={s.id}>
                    <strong>{s.name}</strong>
                    <p>
                      {s.status === "draft"
                        ? "Borrador"
                        : s.status === "reviewed"
                          ? "Revisado"
                          : "Entregado"}{" "}
                      · {new Date(s.updated_at).toLocaleString("es")}
                    </p>
                    <button
                      onClick={() => {
                        setSelected(s);
                        setFeedback(s.feedback);
                      }}
                    >
                      Ver respuestas
                    </button>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
        {selected && (
          <CanvasDialog
            title={`Respuestas · ${selected.name}`}
            onClose={() => {
              if (!busy) setSelected(null);
            }}
          >
            <CanvasReading scene={selected.scene} />
            <label className="form-field">
              <span>Devolución para el estudiante</span>
              <textarea
                maxLength={4000}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </label>
            <div className="cl-actions">
              <button
                disabled={busy || selected.status === "draft"}
                onClick={() => void review()}
              >
                Guardar revisión
              </button>
              <button disabled={busy} onClick={() => setSelected(null)}>
                Cerrar
              </button>
            </div>
          </CanvasDialog>
        )}
        {pdf && (
          <PdfViewer
            blob={pdf.blob}
            document={{ title: pdf.name, originalFilename: pdf.name }}
            onClose={() => setPdf(null)}
          />
        )}
      </main>
    </div>
  );
}
