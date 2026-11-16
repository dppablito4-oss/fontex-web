import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { CanvasDialog } from "../primitives/CanvasDialog";
import type { PrimitiveScene } from "../../core/primitives/schema";
import { classroomClient } from "./classroom-access";
import { classroomAction, type Material } from "./learning-service";
import { useAuth } from "../auth/AuthProvider";
import "../primitives/primitives.css";
import "./classroom-learning.css";
export function PublishLessonDialog({
  scene,
  classroomId,
  onClose,
  onPublished,
}: {
  scene: PrimitiveScene;
  classroomId?: string;
  onClose: () => void;
  onPublished?: (id: string) => void;
}) {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<{ id: string; title: string }[]>(
    [],
  );
  const [classroom, setClassroom] = useState(classroomId ?? ""),
    [title, setTitle] = useState(scene.title),
    [topic, setTopic] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA")),
    [week, setWeek] = useState(1),
    [due, setDue] = useState("");
  const [instructions, setInstructions] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [worksheet, setWorksheet] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [published, setPublished] = useState("");
  useEffect(() => {
    let live = true;
    void classroomClient()
      .rpc("teacher_classrooms")
      .then(({ data, error }) => {
        if (!live) return;
        if (error) {
          setError("No se pudieron cargar tus aulas.");
          return;
        }
        const list = z
          .array(z.object({ id: z.uuid(), title: z.string() }))
          .parse(data);
        setClassrooms(list);
        setClassroom((current) =>
          list.some((c) => c.id === current) ? current : (list[0]?.id ?? ""),
        );
      });
    return () => {
      live = false;
    };
  }, []);
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (busy || !user || !classroom) return;
    setBusy(true);
    setError("");
    const uploaded: string[] = [];
    let committed = false;
    try {
      const pending = [...files];
      if (worksheet) {
        setMessage("Preparando ficha PDF…");
        const { exportCanvasPdf } = await import("../primitives/export-pdf");
        const blank = {
          ...structuredClone(scene),
          title: `Ficha · ${title}`,
          conversation: [],
          primitives: scene.primitives.map((p) =>
            p.kind === "answer_field"
              ? { ...p, data: { ...p.data, answer: "" } }
              : p,
          ),
        };
        const blob = await exportCanvasPdf(
          blank,
          `${location.origin}${location.pathname}#/aula`,
          { download: false },
        );
        pending.push(
          new File([blob], `Ficha - ${title.slice(0, 90)}.pdf`, {
            type: "application/pdf",
          }),
        );
      }
      if (pending.length > 5)
        throw Error("Adjunta hasta 5 PDF, incluida la ficha generada.");
      const attachments: Material[] = [];
      for (const file of pending) {
        if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024)
          throw Error("Cada archivo debe ser PDF y pesar hasta 10 MB.");
        const path = `${classroom}/${user.id}/${crypto.randomUUID()}/${file.name.replace(/[^\p{L}\p{N}_. -]/gu, "-").slice(0, 140)}`;
        setMessage(`Subiendo ${file.name}…`);
        const { error } = await classroomClient()
          .storage.from("class-materials")
          .upload(path, file, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (error)
          throw Error("No se pudo adjuntar el PDF. Reintenta la publicación.");
        uploaded.push(path);
        attachments.push({
          path,
          name: file.name.slice(0, 180),
          type: "application/pdf",
        });
      }
      const { data, error } = await classroomClient().rpc(
        "publish_class_lesson",
        {
          p_classroom: classroom,
          p_scene_id: scene.id,
          p_title: title,
          p_topic: topic,
          p_date: date,
          p_week: week,
          p_instructions: instructions,
          p_due: due ? new Date(due).toISOString() : null,
          p_attachments: attachments,
        },
      );
      if (error)
        throw Error(
          "No se pudo publicar. Guarda primero el lienzo en tu cuenta y comprueba tu rol docente.",
        );
      committed = true;
      setPublished(data);
      onPublished?.(data);
      try {
        const notice = await classroomAction(data, "notify");
        setMessage(notice.message ?? "Clase publicada.");
      } catch {
        setMessage(
          "Clase publicada. Los avisos por correo quedaron pendientes; puedes reintentarlos desde la clase.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar.");
      if (!committed && uploaded.length)
        await classroomClient()
          .storage.from("class-materials")
          .remove(uploaded);
    } finally {
      setBusy(false);
    }
  }
  return (
    <CanvasDialog
      title={published ? "Clase publicada" : "Publicar lienzo en un aula"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {published ? (
        <div className="cl-publish">
          <p role="status">
            {message || "La actividad ya está disponible en el aula."}
          </p>
          <a href={`#/clase/${published}`}>Abrir clase y entregas</a>
          <button onClick={onClose}>Cerrar</button>
        </div>
      ) : (
        <form className="cl-publish" onSubmit={(e) => void publish(e)}>
          <p>
            Publica una copia del lienzo con instrucciones y materiales. Tu
            original permanece en tu biblioteca.
          </p>
          <label className="form-field">
            <span>Aula de destino</span>
            <select
              required
              disabled={busy}
              value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
            >
              {!classrooms.length && (
                <option value="">No tienes aulas con rol docente</option>
              )}
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Título de la clase</span>
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Tema</span>
            <input
              maxLength={160}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </label>
          <div className="cl-publish-grid">
            <label className="form-field">
              <span>Fecha de la clase</span>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Semana</span>
              <input
                required
                type="number"
                min={1}
                max={100}
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="form-field">
            <span>Actividad e instrucciones</span>
            <textarea
              maxLength={4000}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Qué deben practicar y entregar tus estudiantes"
            />
          </label>
          <label className="form-field">
            <span>Fecha límite (opcional)</span>
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Adjuntar PDF (hasta 5, 10 MB por archivo)</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={busy}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={worksheet}
              onChange={(e) => setWorksheet(e.target.checked)}
            />{" "}
            Generar y adjuntar ficha PDF de este lienzo
          </label>
          <p className="cl-meta">
            Habilita los valores del ejercicio desde las propiedades de cada
            elemento antes de publicarlo. Las definiciones quedan protegidas.
            Los integrantes con correo confirmado recibirán un aviso.
          </p>
          {error && (
            <p role="alert" className="cl-error">
              {error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <div className="cl-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={busy || !classroom}>
              {busy ? "Publicando…" : "Publicar actividad"}
            </button>
          </div>
        </form>
      )}
    </CanvasDialog>
  );
}
