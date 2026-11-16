import { useEffect, useState } from "react";
import { BookOpen, FileText, PenTool, Plus } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { classroomClient } from "./classroom-access";
import { useClassroomGuest } from "./classroom-guest-context";
import { ClassroomGuestBanner } from "./ClassroomGuestProvider";
import { PublishLessonDialog } from "./PublishLessonDialog";
import { listLessons, type LessonSummary } from "./learning-service";
import {
  parsePrimitiveScene,
  type PrimitiveScene,
} from "../../core/primitives/schema";
import { SiteHeader } from "../../components/ProductNavigation";
import "./classroom-learning.css";
export function ClassroomLearning({
  classroomId,
  teacher = false,
}: {
  classroomId: string;
  teacher?: boolean;
}) {
  const { user } = useAuth();
  const { guest } = useClassroomGuest();
  const [lessons, setLessons] = useState<LessonSummary[]>([]),
    [canvases, setCanvases] = useState<
      { id: string; scene_title: string | null }[]
    >([]);
  const [filter,setFilter]=useState("");
  const [visible,setVisible]=useState(12);
  const [selected, setSelected] = useState(""),
    [scene, setScene] = useState<PrimitiveScene | null>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void listLessons(classroomId)
      .then((v) => {
        if (live) {
          setLessons(v);
          setError("");
        }
      })
      .catch((e) => {
        if (live)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la clase.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [classroomId, guest?.token, reload]);
  useEffect(() => {
    if (!teacher || !user) return;
    let live = true;
    void classroomClient()
      .from("visual_scenes")
      .select("id,scene_title")
      .eq("user_id", user.id)
      .eq("scene->>format", "primitive-scene")
      .order("updated_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setError("No se pudo cargar tu biblioteca de lienzos.");
        else setCanvases(data ?? []);
      });
    return () => {
      live = false;
    };
  }, [teacher, user, reload]);
  async function publish() {
    if (!selected || !user || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await classroomClient()
        .from("visual_scenes")
        .select("scene")
        .eq("id", selected)
        .eq("user_id", user.id)
        .single();
      if (error) throw Error("No se pudo abrir este lienzo.");
      setScene(parsePrimitiveScene(data.scene));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir.");
    } finally {
      setBusy(false);
    }
  }
  const filteredCanvases=canvases.filter(c=>(c.scene_title??"").toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  const weeks = [...new Set(lessons.map((l) => l.week))].sort((a, b) => b - a);
  return (
    <div className="cl-learning">
      {teacher && (
        <section aria-label="Mis lienzos para publicar">
          <div className="cl-heading">
            <div>
              <p className="eyebrow">Preparar tu clase</p>
              <h2>Elige un lienzo y publícalo</h2>
            </div>
            <div className="cl-actions">
              <a href={`#/lienzo?aula=${classroomId}&nuevo=1`}>
                <Plus size={16} /> Crear lienzo
              </a>
              <button
                disabled={!selected || busy}
                onClick={() => void publish()}
              >
                {busy ? "Abriendo…" : "Publicar seleccionado"}
              </button>
            </div>
          </div>
          <label className="form-field mt-4"><span>Buscar un lienzo</span><input value={filter} maxLength={160} onChange={e=>{setFilter(e.target.value);setVisible(12);}} placeholder="Fracciones, derivadas, tablas…"/></label>
          <div className="cl-grid mt-4">
            {filteredCanvases.slice(0,visible).map((c) => (
              <article
                className="cl-card"
                key={c.id}
                data-selected={selected === c.id}
              >
                <div className="cl-thumb">
                  <PenTool size={24} />
                  <span>Mi lienzo personal</span>
                </div>
                <h3>{c.scene_title || "Sin título"}</h3>
                <label>
                  <input
                    type="radio"
                    name="canvas-to-publish"
                    value={c.id}
                    checked={selected === c.id}
                    onChange={() => setSelected(c.id)}
                  />{" "}
                  Seleccionar para publicar
                </label>
                <a href={`#/lienzo?abrir=${c.id}&aula=${classroomId}`}>
                  Editar lienzo
                </a>
              </article>
            ))}
          </div>
          {filteredCanvases.length>visible && <button className="mt-4" onClick={()=>setVisible(n=>n+12)}>Mostrar más lienzos ({filteredCanvases.length-visible})</button>}
          {!filteredCanvases.length && canvases.length>0 && <p className="cl-status">No hay lienzos con ese título.</p>}
          {!canvases.length && (
            <p className="cl-status">
              Crea y guarda tu primer lienzo. Aquí aparecerá listo para
              publicar.
            </p>
          )}
        </section>
      )}
      <section aria-label="Clases y actividades">
        <div className="cl-heading">
          <div>
            <p className="eyebrow">Aprender y practicar</p>
            <h2>Clases y actividades</h2>
          </div>
          <button onClick={() => setReload((v) => v + 1)}>
            Actualizar clases
          </button>
        </div>
        {loading && <p role="status">Cargando clases…</p>}
        {!loading && !lessons.length && (
          <p className="cl-status">
            Todavía no hay clases publicadas. Aquí aparecerán los lienzos, los
            PDF y las actividades del docente.
          </p>
        )}
        {weeks.map((week) => (
          <section className="mt-5" key={week}>
            <h3 className="cl-week">Semana {week}</h3>
            <div className="cl-grid">
              {lessons
                .filter((l) => l.week === week)
                .map((l) => (
                  <article className="cl-card" key={l.id}>
                    <div className="cl-thumb">
                      <BookOpen size={24} />
                      <span>{l.topic || "Clase"}</span>
                    </div>
                    <p className="cl-meta">
                      {new Date(`${l.class_date}T12:00:00`).toLocaleDateString(
                        "es",
                        { dateStyle: "long" },
                      )}
                    </p>
                    <h3>{l.title}</h3>
                    <p>{l.instructions.slice(0, 180)}</p>
                    {l.due_at && (
                      <p className="cl-meta">
                        Entrega: {new Date(l.due_at).toLocaleString("es")}
                      </p>
                    )}
                    <span className="cl-meta">
                      {teacher
                        ? `${l.deliveries} entregas`
                        : l.status === "reviewed"
                          ? "Revisado por el docente"
                          : l.status === "submitted"
                            ? "Actividad entregada"
                            : l.status === "draft"
                              ? "Borrador guardado"
                              : "Pendiente de practicar"}
                    </span>
                    <a href={`#/clase/${l.id}`}>
                      <FileText size={15} />{" "}
                      {teacher
                        ? "Abrir clase y entregas"
                        : "Abrir clase y practicar"}
                    </a>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </section>
      {error && (
        <p role="alert" className="cl-error">
          {error}
        </p>
      )}
      {scene && (
        <PublishLessonDialog
          scene={scene}
          classroomId={classroomId}
          onClose={() => {
            setScene(null);
            setReload((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
export function GuestClassroomPage() {
  const { guest, active, checking } = useClassroomGuest();
  return (
    <div className="pc-app cl-page">
      <SiteHeader />
      <ClassroomGuestBanner />
      <main className="cl-player">
        <h1>{guest?.title || "Mi aula"}</h1>
        <p>
          Accede a los lienzos, los materiales y las actividades de tu clase.
        </p>
        {guest && active ? (
          <ClassroomLearning
            key={guest.classroom_id}
            classroomId={guest.classroom_id}
          />
        ) : (
          <p role="status">
            {checking
              ? "Comprobando tu acceso…"
              : "Tu acceso temporal finalizó. Vincula tu cuenta o solicita otra invitación."}
          </p>
        )}
      </main>
    </div>
  );
}
