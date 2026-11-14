import {
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Expand,
  GripVertical,
  MessageCircle,
  Pencil,
  Plus,
  Redo2,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { SiteHeader } from "../../components/ProductNavigation";
import { useAuth } from "../auth/AuthProvider";
import { AcademicMarkdown } from "../tutor/components/AcademicMarkdown";
import { usePrimitiveStore } from "./usePrimitiveStore";
import { PrimitiveVisual } from "./PrimitiveVisual";
import { PrimitiveFields } from "./PrimitiveFields";
import {
  applyPrimitivePatch,
  createPrimitive,
  MAX_PRIMITIVE_BYTES,
  newPrimitiveScene,
  parsePrimitiveScene,
  type Primitive,
  type PrimitiveKind,
  primitiveNames,
  type PrimitiveScene,
} from "../../core/primitives/schema";
import { sceneFunctions, sceneScope } from "../../core/primitives/math";
import { templates, templateScene } from "../../core/primitives/templates";
import { requestPrimitiveAgent } from "./agent";
import "./primitives.css";
type Tab = "chat" | "elements" | "templates" | "variables";
type Drag = {
  kind: "move" | "resize";
  id: string;
  x: number;
  y: number;
  old: Primitive;
  scene: PrimitiveScene;
};
function Frame({
  p,
  children,
  selected,
  editing,
  onSelect,
  onDrag,
  onFit,
  narrow,
}: {
  p: Primitive;
  children: React.ReactNode;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onDrag: (e: PointerEvent<HTMLButtonElement>, kind: "move" | "resize") => void;
  onFit: (id: string, height: number) => void;
  narrow: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = content.current;
    if (!node || narrow || !p.autoHeight) return;
    const observer = new ResizeObserver(() => {
      const next = Math.ceil(node.scrollHeight + 54);
      if (Math.abs(next - p.height) > 3) {
        onFit(p.id, Math.max(100, Math.min(100000, next)));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [p.id, p.height, p.autoHeight, p.width, onFit, narrow]);
  return (
    <article
      className={`pc-object pc-node-${p.kind}${selected ? " pc-selected" : ""}`}
      style={{
        left: p.x,
        top: p.y,
        width: p.width,
        height: p.autoHeight ? "auto" : p.height,
        minHeight: p.autoHeight ? p.height : undefined,
        zIndex: selected ? 100 : p.zIndex,
        transform: `rotate(${p.rotation}deg)`,
        opacity: p.style.opacity,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (
          !(e.target as HTMLElement).closest("input,textarea,button,select,a")
        ) onSelect();
      }}
      tabIndex={0}
      aria-label={p.label || primitiveNames[p.kind]}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onSelect();
      }}
    >
      <header className="pc-object-heading">
        <span>{p.label || primitiveNames[p.kind]}</span>
        {editing && (
          <button
            aria-label={`Mover ${p.label}`}
            title="Arrastrar objeto"
            disabled={p.locked}
            onPointerDown={(e) => onDrag(e, "move")}
          >
            <GripVertical size={16} />
          </button>
        )}
      </header>
      <div className="pc-object-content" ref={content}>{children}</div>
      {editing && selected && (
        <button
          className="pc-resize"
          aria-label="Cambiar tamaño"
          disabled={p.locked}
          onPointerDown={(e) => onDrag(e, "resize")}
        >
          ↘
        </button>
      )}
    </article>
  );
}
export function PrimitiveCanvas() {
  const { user } = useAuth();
  return (
    <Editor
      key={user?.id ?? "guest"}
      owner={user?.id ?? "guest"}
      authenticated={!!user}
    />
  );
}
function Editor(
  { owner, authenticated }: { owner: string; authenticated: boolean },
) {
  const library = usePrimitiveStore(owner), { scene, setScene } = library;
  const [selectedId, setSelected] = useState<string | null>(null),
    [tab, setTab] = useState<Tab>("chat"),
    [sidebar, setSidebar] = useState(() =>
      !window.matchMedia("(max-width:760px)").matches
    );
  const [narrow, setNarrow] = useState(() =>
      window.matchMedia("(max-width:760px)").matches
    ),
    [zoom, setZoom] = useState(1),
    [autoZoom, setAutoZoom] = useState(true);
  const [past, setPast] = useState<PrimitiveScene[]>([]),
    [future, setFuture] = useState<PrimitiveScene[]>([]),
    [notice, setNotice] = useState(""),
    [presenting, setPresenting] = useState(false),
    [step, setStep] = useState(1);
  const [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [streamText, setStreamText] = useState("");
  const level = scene.level;
  const [variableName, setVariableName] = useState("b"),
    [templateFilter, setTemplateFilter] = useState("");
  const variableBatch = useRef({ name: "", time: 0 });
  const root = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    drag = useRef<Drag | null>(null),
    live = useRef(scene),
    abort = useRef<AbortController | null>(null),
    messageEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    live.current = scene;
  }, [scene]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    messageEnd.current?.scrollIntoView({ block: "nearest" });
  }, [scene.conversation.length, streamText]);
  useEffect(() => {
    const query = window.matchMedia("(max-width:760px)");
    const change = () => setNarrow(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      if (autoZoom && !narrow) {
        setZoom(Math.min(1, (node.clientWidth - 32) / 1200));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoZoom, narrow, sidebar]);
  useEffect(() => {
    const exit = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", exit);
    return () => document.removeEventListener("fullscreenchange", exit);
  }, []);
  function commit(next: PrimitiveScene, history = true) {
    try {
      const valid = parsePrimitiveScene(next);
      if (history) {
        setPast((h) => [...h.slice(-39), live.current]);
        setFuture([]);
      }
      live.current = valid;
      setScene(valid);
      setNotice("");
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "El cambio no es válido.");
      return false;
    }
  }
  function update(p: Primitive) {
    return commit({
      ...live.current,
      primitives: live.current.primitives.map((old) =>
        old.id === p.id ? p : old
      ),
    });
  }
  const fit = useCallback((id: string, height: number) => {
    const current = live.current,
      p = current.primitives.find((n) => n.id === id);
    if (!p || !p.autoHeight || Math.abs(p.height - height) < 4) return;
    const delta = height - p.height,
      next = {
        ...current,
        primitives: current.primitives.map((n) =>
          n.id === id
            ? { ...n, height }
            : n.y >= p.y + p.height - 1 && n.x < p.x + p.width &&
                n.x + n.width > p.x
            ? { ...n, y: Math.max(0, n.y + delta) }
            : n
        ),
      };
    try {
      const valid = parsePrimitiveScene(next);
      live.current = valid;
      setScene(valid);
    } catch { /* Keep a valid layout when near the scene bounds. */ }
  }, [setScene]);
  const variable = useCallback((name: string, value: number) => {
    const current = live.current;
    try {
      const valid = parsePrimitiveScene({
        ...current,
        variables: current.variables.map((v) =>
          v.name === name ? { ...v, value } : v
        ),
      });
      if (
        valid.variables.find((v) => v.name === name)?.value ===
          current.variables.find((v) => v.name === name)?.value
      ) return;
      const now = Date.now();
      if (
        variableBatch.current.name !== name ||
        now - variableBatch.current.time > 700
      ) {
        setPast((h) => [...h.slice(-39), current]);
        setFuture([]);
      }
      variableBatch.current = { name, time: now };
      live.current = valid;
      setScene(valid);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "El valor no es válido.");
    }
  }, [setScene]);
  function undo() {
    variableBatch.current = { name: "", time: 0 };
    const previous = past.at(-1);
    if (previous) {
      setFuture((h) => [live.current, ...h]);
      setPast((h) => h.slice(0, -1));
      commit(previous, false);
    }
  }
  function redo() {
    variableBatch.current = { name: "", time: 0 };
    const next = future[0];
    if (next) {
      setPast((h) => [...h, live.current]);
      setFuture((h) => h.slice(1));
      commit(next, false);
    }
  }
  function remove() {
    if (!selectedId) return;
    try {
      commit(
        applyPrimitivePatch(live.current, {
          message: "Eliminar",
          actions: [{ kind: "delete_primitive", id: selectedId }],
        }),
      );
      setSelected(null);
    } catch (e) {
      setNotice(String(e));
    }
  }
  const selected = scene.primitives.find((p) => p.id === selectedId),
    scope = sceneScope(scene),
    functions = sceneFunctions(scene);
  const maxStep = Math.max(
    1,
    ...scene.primitives.map((p) => p.presentationStep),
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      ) return;
      if (e.key === "Escape") {
        setSelected(null);
        setPresenting(false);
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        }
      }
      if (presenting && ["ArrowRight", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        setStep((s) =>
          Math.max(1, Math.min(maxStep, s + (e.key === "ArrowRight" ? 1 : -1)))
        );
      }
      if (
        !presenting && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"
      ) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (!presenting && e.key === "Delete" && !selected?.locked) remove();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function add(kind: PrimitiveKind) {
    const next = structuredClone(live.current);
    if (
      kind === "function_region" &&
      !next.primitives.some((p) => p.kind === "coordinate_canvas")
    ) next.primitives.push(createPrimitive("coordinate_canvas", next));
    const p = createPrimitive(kind, next);
    next.primitives.push(p);
    if (commit(next)) {
      setSelected(p.id);
      if (narrow) setSidebar(false);
    }
  }
  function beginDrag(
    e: PointerEvent<HTMLButtonElement>,
    kind: "move" | "resize",
    p: Primitive,
  ) {
    if (p.locked || narrow) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      kind,
      id: p.id,
      x: e.clientX,
      y: e.clientY,
      old: p,
      scene: live.current,
    };
    setSelected(p.id);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / zoom, dy = (e.clientY - d.y) / zoom;
    const p = d.kind === "move"
      ? {
        ...d.old,
        x: Math.max(0, Math.min(1200 - d.old.width, d.old.x + dx)),
        y: Math.max(0, d.old.y + dy),
      }
      : {
        ...d.old,
        width: Math.max(100, Math.min(1200 - d.old.x, d.old.width + dx)),
        height: Math.max(100, Math.min(100000, d.old.height + dy)),
        autoHeight: false,
      };
    commit({
      ...live.current,
      primitives: live.current.primitives.map((n) => n.id === p.id ? p : n),
    }, false);
  }
  function endDrag() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setPast((h) => [...h.slice(-39), d.scene]);
    setFuture([]);
  }
  function load(id: string) {
    if (commit(templateScene(id))) {
      setSelected(null);
      setStep(1);
      if (narrow) setSidebar(false);
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify(scene, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${scene.title || "fontex"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function ask(task: "chat" | "build", question = prompt) {
    if (!question.trim() || busy) return;
    if (!authenticated) {
      setNotice(
        "Inicia sesión para conversar con Fontex AI. Puedes crear con las plantillas y los nueve elementos sin usar IA.",
      );
      return;
    }
    const before = live.current, controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setStreamText("");
    setNotice("");
    setPrompt("");
    const last = before.conversation.at(-1);
    const turns =
      (last?.role === "user" && last.content === question.trim()
        ? before.conversation
        : [...before.conversation, {
          role: "user" as const,
          content: question.trim(),
        }]).slice(-78);
    commit({ ...before, conversation: turns }, false);
    try {
      const reply = await requestPrimitiveAgent(
        { scene: before, question: question.trim(), task, level, selectedId },
        setStreamText,
        controller.signal,
      );
      if (
        live.current.id !== before.id ||
        JSON.stringify(live.current.primitives) !==
          JSON.stringify(before.primitives) ||
        JSON.stringify(live.current.variables) !==
          JSON.stringify(before.variables)
      ) {
        throw Error(
          "El lienzo cambió durante la generación. Vuelve a pedir la propuesta sobre la versión actual.",
        );
      }
      const patched = task === "build"
        ? applyPrimitivePatch(live.current, reply, templateScene)
        : live.current;
      if (task === "chat" && reply.actions.length) {
        throw Error("La conversación devolvió cambios inesperados.");
      }
      commit({
        ...patched,
        conversation: [...turns, {
          role: "assistant" as const,
          content: reply.message,
        }].slice(-80),
      }, task === "build");
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "La respuesta no se completó. Tu lienzo sigue intacto.",
      );
      setPrompt(question);
    } finally {
      setBusy(false);
      setStreamText("");
      abort.current = null;
    }
  }
  function duplicate() {
    if (!selected) return;
    const p = {
      ...structuredClone(selected),
      id: crypto.randomUUID(),
      label: `${selected.label} (copia)`,
      y: selected.y + selected.height + 24,
      zIndex: scene.primitives.length,
    };
    if (p.kind === "function_region") {
      p.data.name = `f${scene.primitives.length + 1}`;
      p.data.resultName = `area${scene.primitives.length + 1}`;
    }
    const extra = selected.kind === "coordinate_canvas"
      ? scene.primitives.flatMap((child, i) => {
        if (
          !("canvasId" in child.data) || child.data.canvasId !== selected.id
        ) return [];
        const copy = {
          ...structuredClone(child),
          id: crypto.randomUUID(),
          data: { ...child.data, canvasId: p.id },
        } as Primitive;
        if (copy.kind === "function_region") {
          copy.data.name = `f_copy_${scene.primitives.length + i}`;
          copy.data.resultName = `area_copy_${scene.primitives.length + i}`;
        }
        return [copy];
      })
      : [];
    commit({ ...scene, primitives: [...scene.primitives, p, ...extra] });
  }
  useEffect(() => {
    if (!presenting) return;
    const node = stage.current?.querySelectorAll<HTMLElement>(".pc-object");
    requestAnimationFrame(() =>
      node?.[node.length - 1]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    );
  }, [presenting, step]);
  const roots = scene.primitives.filter((p) =>
      !("canvasId" in p.data && p.data.canvasId)
    ),
    height = Math.max(700, ...roots.map((p) => p.y + p.height + 40));
  return (
    <div
      className={`pc-app${presenting ? " pc-presenting" : ""}${
        sidebar ? " pc-sidebar-open" : ""
      }`}
      ref={root}
      onPointerMove={move}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <SiteHeader />
      <header className="pc-topbar">
        <input
          aria-label="Título del lienzo"
          value={scene.title}
          maxLength={160}
          onChange={(e) => commit({ ...scene, title: e.target.value })}
        />
        <span className="pc-save">
          <Check size={14} />
          {library.status === "saved"
            ? "Guardado en tu cuenta"
            : library.status === "local"
            ? "Guardado local"
            : library.status === "saving" || library.status === "loading"
            ? "Sincronizando…"
            : "Guardado local · sincronización pendiente"}
        </span>
        <div className="pc-top-actions">
          <button aria-label="Deshacer" disabled={!past.length} onClick={undo}>
            <Undo2 size={17} />
          </button>
          <button aria-label="Rehacer" disabled={!future.length} onClick={redo}>
            <Redo2 size={17} />
          </button>
          <button
            onClick={() => {
              setTab("elements");
              setSidebar(true);
            }}
          >
            <Plus size={17} />Elementos
          </button>
          <button
            onClick={() => {
              setTab("chat");
              setSidebar(!sidebar || tab !== "chat");
            }}
          >
            <MessageCircle size={17} />
            <span>Asistente</span>
          </button>
          <button
            onClick={() => {
              setSelected(null);
              window.print();
            }}
          >
            <Download size={17} />PDF
          </button>
          <button
            className="pc-primary"
            disabled={!scene.primitives.length}
            onClick={() => {
              setSelected(null);
              setStep(1);
              setPresenting(true);
              void root.current?.requestFullscreen?.().catch(() => {});
            }}
          >
            <Expand size={17} />Presentar
          </button>
        </div>
      </header>
      {(notice || library.notice) && (
        <div className="pc-banner" role="status">
          {notice || library.notice}
          <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {presenting && (
        <nav className="pc-present-bar">
          <strong>{scene.title}</strong>
          <span>Paso {step} de {maxStep}</span>
          <button
            disabled={step === 1}
            aria-label="Paso anterior"
            onClick={() => setStep((s) => s - 1)}
          >
            <ChevronLeft />
          </button>
          <button
            disabled={step === maxStep}
            aria-label="Paso siguiente"
            onClick={() => setStep((s) => s + 1)}
          >
            <ChevronRight />
          </button>
          <button
            onClick={() => {
              setPresenting(false);
              if (document.fullscreenElement) {
                void document.exitFullscreen().catch(() => {});
              }
            }}
          >
            Salir de presentación
          </button>
        </nav>
      )}
      <div className="pc-shell">
        {sidebar && !presenting && (
          <aside className="pc-sidebar" aria-label="Panel de Fontex">
            <header>
              <strong>Fontex Agente</strong>
              <button
                aria-label="Cerrar panel"
                onClick={() =>
                  setSidebar(false)}
              >
                <X size={18} />
              </button>
            </header>
            <nav className="pc-tabs">
              {(["chat", "elements", "templates", "variables"] as const).map(
                (t) => (
                  <button
                    key={t}
                    aria-pressed={tab === t}
                    onClick={() => setTab(t)}
                  >
                    {({
                      chat: "Chat",
                      elements: "Elementos",
                      templates: "Plantillas",
                      variables: "Variables",
                    })[t]}
                  </button>
                ),
              )}
            </nav>
            {tab === "chat"
              ? (
                <>
                  <div className="pc-chat-log" role="log" aria-live="polite">
                    {!scene.conversation.length && (
                      <div className="pc-chat-welcome">
                        <span>✦</span>
                        <h2>¿Qué exploramos?</h2>
                        <p>
                          Conversa, prepara una explicación o construye una idea
                          en el lienzo.
                        </p>
                        <div>
                          {[
                            "Explica qué representa una derivada",
                            "Quiero explorar áreas y perímetros",
                            "Cómo sumo fracciones",
                          ].map((q) => (
                            <button
                              key={q}
                              onClick={() => setPrompt(q)}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {scene.conversation.map((turn, i) => (
                      <div
                        className={`pc-message pc-message-${turn.role}`}
                        key={i}
                      >
                        <small>
                          {turn.role === "user" ? "Tú" : "Fontex AI"}
                        </small>
                        <AcademicMarkdown content={turn.content} />
                        {turn.role === "assistant" &&
                          i === scene.conversation.length - 1 && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void ask(
                                "build",
                                `Construye en el lienzo la propuesta acordada en la conversación. Última propuesta: ${
                                  turn.content.slice(0, 3000)
                                }`,
                              )}
                          >
                            <Plus size={15} />Crear en el lienzo
                          </button>
                        )}
                      </div>
                    ))}
                    {busy && (
                      <div className="pc-message">
                        <small>Fontex AI</small>
                        <AcademicMarkdown
                          content={streamText || "Preparando…"}
                        />
                        <span className="pc-writing">Escribiendo…</span>
                      </div>
                    )}
                    <div ref={messageEnd} />
                  </div>
                  <form
                    className="pc-chat-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void ask("chat");
                    }}
                  >
                    <label>
                      Nivel<select
                        value={level}
                        onChange={(e) =>
                          commit({
                            ...scene,
                            level: e.target.value as typeof level,
                          })}
                      >
                        <option value="inicial">Inicial</option>
                        <option value="primaria">Primaria</option>
                        <option value="secundaria">Secundaria</option>
                        <option value="universidad">Universidad</option>
                      </select>
                    </label>
                    <textarea
                      aria-label="Mensaje para Fontex AI"
                      placeholder="Escribe una idea o una pregunta…"
                      value={prompt}
                      onChange={(e) =>
                        setPrompt(e.target.value)}
                      maxLength={4000}
                      rows={3}
                    />
                    <div>
                      <button
                        type="button"
                        disabled={busy || !prompt.trim()}
                        onClick={() => void ask("build")}
                      >
                        <Plus size={16} />Crear lienzo
                      </button>
                      <button
                        type="submit"
                        className="pc-primary"
                        disabled={busy || !prompt.trim()}
                      >
                        <Send size={16} />Enviar
                      </button>
                      {busy && (
                        <button
                          type="button"
                          onClick={() => abort.current?.abort()}
                        >
                          Detener
                        </button>
                      )}
                    </div>
                  </form>
                </>
              )
              : (
                <div className="pc-panel-content">
                  {tab === "elements" && (
                    <>
                      <h2>Combina elementos</h2>
                      <p>Nueve primitivas para construir representaciones.</p>
                      <div className="pc-element-list">
                        {(Object.keys(primitiveNames) as PrimitiveKind[]).map((
                          kind,
                          i,
                        ) => (
                          <button
                            key={kind}
                            onClick={() => add(kind)}
                          >
                            <span>
                              {[
                                "⊞",
                                "ƒ",
                                "↗",
                                "▦",
                                "T",
                                "☷",
                                "⬡",
                                "▥",
                                "✎",
                              ][i]}
                            </span>
                            <strong>{primitiveNames[kind]}</strong>
                            <Plus size={16} />
                          </button>
                        ))}
                      </div>
                      {!!scene.primitives.length && (
                        <>
                          <h3>En este lienzo</h3>
                          {scene.primitives.map((p) => (
                            <button
                              className="pc-layer"
                              key={p.id}
                              aria-pressed={selectedId === p.id}
                              onClick={() => {
                                setSelected(p.id);
                                if (narrow) setSidebar(false);
                              }}
                            >
                              {p.label || primitiveNames[p.kind]}
                            </button>
                          ))}
                        </>
                      )}
                    </>
                  )}
                  {tab === "templates" && (
                    <>
                      <h2>Un punto de partida</h2>
                      <input
                        aria-label="Buscar plantilla"
                        placeholder="Tema o nivel…"
                        value={templateFilter}
                        onChange={(e) => setTemplateFilter(e.target.value)}
                      />
                      <div className="pc-templates">
                        {templates.filter((t) =>
                          `${t.name} ${t.group}`.toLowerCase().includes(
                            templateFilter.toLowerCase(),
                          )
                        ).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => load(t.id)}
                          >
                            <small>{t.group}</small>
                            <strong>{t.name}</strong>
                            <span>Abrir como escena editable ↗</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {tab === "variables" && (
                    <>
                      <h2>Variables compartidas</h2>
                      <p>
                        Vincula estos nombres a figuras, funciones y textos.
                      </p>
                      {scene.variables.map((v) => (
                        <div className="pc-variable-card" key={v.name}>
                          <strong>
                            {v.name} <small>{v.unit}</small>
                          </strong>
                          <label>
                            Valor<input
                              aria-label={`Valor de ${v.name}`}
                              type="number"
                              value={v.value}
                              min={v.min}
                              max={v.max}
                              step={v.step}
                              onChange={(e) =>
                                variable(v.name, Number(e.target.value))}
                            />
                          </label>
                          {(["min", "max", "step", "unit"] as const).map(
                            (key) => (
                              <label key={key}>
                                {{
                                  min: "Mínimo",
                                  max: "Máximo",
                                  step: "Paso",
                                  unit: "Unidad",
                                }[key]}
                                <input
                                  type={key === "unit" ? "text" : "number"}
                                  value={v[key]}
                                  onChange={(e) =>
                                    commit({
                                      ...scene,
                                      variables: scene.variables.map((item) =>
                                        item.name === v.name
                                          ? {
                                            ...item,
                                            [key]: key === "unit"
                                              ? e.target.value
                                              : Number(e.target.value),
                                          }
                                          : item
                                      ),
                                    })}
                                />
                              </label>
                            ),
                          )}
                          <button
                            onClick={() => {
                              const p = createPrimitive(
                                "control_slider",
                                scene,
                              );
                              p.data.variableName = v.name;
                              if (
                                commit({
                                  ...scene,
                                  primitives: [...scene.primitives, p],
                                })
                              ) {
                                setSelected(p.id);
                              }
                            }}
                          >
                            Añadir control al lienzo
                          </button>
                        </div>
                      ))}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (
                            commit({
                              ...scene,
                              variables: [...scene.variables, {
                                name: variableName,
                                value: 1,
                                min: 0,
                                max: 10,
                                step: .1,
                                unit: "",
                              }],
                            })
                          ) setVariableName(`v${scene.variables.length + 1}`);
                        }}
                      >
                        <label>
                          Nueva variable<input
                            value={variableName}
                            onChange={(e) =>
                              setVariableName(e.target.value)}
                            maxLength={32}
                          />
                        </label>
                        <button>
                          <Plus size={16} />Crear variable
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
            <footer className="pc-library">
              <label>
                Mis lienzos<select
                  aria-label="Mis lienzos"
                  value={scene.id}
                  onChange={(e) => {
                    if (busy) abort.current?.abort();
                    library.open(e.target.value);
                    setSelected(null);
                    setPast([]);
                    setFuture([]);
                    setStep(1);
                  }}
                >
                  {library.scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || "Sin título"}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <button
                  onClick={() => {
                    commit(newPrimitiveScene());
                    setSelected(null);
                  }}
                >
                  Nuevo
                </button>
                <button onClick={download}>Guardar JSON</button>
                <button onClick={() => file.current?.click()}>
                  Abrir JSON
                </button>
              </div>
            </footer>
          </aside>
        )}
        <main
          aria-label="Lienzo matemático"
          className="pc-stage"
          ref={stage}
          onClick={() => setSelected(null)}
        >
          {selected && !presenting && (
            <section
              className="pc-selection-bar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pc-selection-actions">
                <strong>{primitiveNames[selected.kind]}</strong>
                <label>
                  Nombre<input
                    aria-label="Nombre del elemento"
                    value={selected.label}
                    maxLength={120}
                    onChange={(e) =>
                      update({ ...selected, label: e.target.value })}
                  />
                </label>
                <label>
                  Color<input
                    type="color"
                    aria-label="Color del elemento"
                    value={selected.style.strokeColor}
                    onChange={(e) =>
                      update({
                        ...selected,
                        style: {
                          ...selected.style,
                          strokeColor: e.target.value,
                        },
                      })}
                  />
                </label>
                <label>
                  Relleno<input
                    type="color"
                    aria-label="Relleno del elemento"
                    value={selected.style.fillColor}
                    onChange={(e) =>
                      update({
                        ...selected,
                        style: { ...selected.style, fillColor: e.target.value },
                      })}
                  />
                </label>
                <button aria-label="Duplicar elemento" onClick={duplicate}>
                  <Copy size={16} />
                </button>
                <button
                  aria-label="Eliminar elemento"
                  disabled={selected.locked}
                  onClick={remove}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  aria-label="Cerrar edición"
                  onClick={() => setSelected(null)}
                >
                  <X size={16} />
                </button>
              </div>
              <PrimitiveFields
                key={selected.id}
                p={selected}
                scene={scene}
                onChange={update}
              />
              <details>
                <summary>Posición, tamaño y presentación</summary>
                <div className="pc-field-row">
                  {([
                    "x",
                    "y",
                    "width",
                    "height",
                    "rotation",
                    "presentationStep",
                  ] as const).map((key) => (
                    <label key={key}>
                      {{
                        x: "Posición x",
                        y: "Posición y",
                        width: "Ancho",
                        height: "Alto",
                        rotation: "Rotación",
                        presentationStep: "Paso de presentación",
                      }[key]}
                      <input
                        type="number"
                        value={selected[key]}
                        onChange={(e) =>
                          update({
                            ...selected,
                            [key]: Number(e.target.value),
                            ...(key === "height" ? { autoHeight: false } : {}),
                          })}
                      />
                    </label>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.locked}
                      onChange={(e) =>
                        update({ ...selected, locked: e.target.checked })}
                    />Bloquear
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.autoHeight}
                      onChange={(e) =>
                        update({ ...selected, autoHeight: e.target.checked })}
                    />Ajustar alto al contenido
                  </label>
                  <label>
                    Tamaño de letra<input
                      type="number"
                      min="12"
                      max="80"
                      value={selected.style.fontSize}
                      onChange={(e) =>
                        update({
                          ...selected,
                          style: {
                            ...selected.style,
                            fontSize: Number(e.target.value),
                          },
                        })}
                    />
                  </label>
                </div>
              </details>
            </section>
          )}
          {!roots.length
            ? (
              <div className="pc-empty">
                <span className="pc-empty-symbol">
                  ƒ <span>⬡</span> ↗
                </span>
                <small>UN LIENZO. IDEAS QUE SE CONECTAN.</small>
                <h1>Construye algo que puedas explorar.</h1>
                <p>
                  Combina figuras, expresiones y datos. Cambia un valor y
                  descubre qué sucede.
                </p>
                <div>
                  {["calculus", "fractions", "geometry"].map((id) => (
                    <button
                      key={id}
                      onClick={(e) => {
                        e.stopPropagation();
                        load(id);
                      }}
                    >
                      <Pencil size={20} />
                      {templates.find((t) => t.id === id)?.name}
                      <span>↗</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTab("elements");
                    setSidebar(true);
                  }}
                >
                  <Plus size={17} />Explorar los nueve elementos
                </button>
              </div>
            )
            : (
              <div
                className="pc-board-space"
                style={{
                  width: narrow ? "100%" : 1200 * zoom,
                  height: narrow ? "auto" : height * zoom,
                }}
              >
                <div
                  className="pc-board"
                  style={{
                    width: narrow ? "100%" : 1200,
                    height: narrow ? "auto" : height,
                    transform: narrow ? "none" : `scale(${zoom})`,
                  }}
                >
                  {roots.filter((p) =>
                    !presenting || p.presentationStep <= step
                  ).sort((a, b) => a.y - b.y || a.x - b.x).map((p) => (
                    <Frame
                      key={p.id}
                      p={p}
                      selected={p.id === selectedId}
                      editing={!presenting}
                      onSelect={() => {
                        if (!presenting) setSelected(p.id);
                      }}
                      onDrag={(e, kind) => beginDrag(e, kind, p)}
                      onFit={fit}
                      narrow={narrow}
                    >
                      <PrimitiveVisual
                        p={p}
                        scene={presenting
                          ? {
                            ...scene,
                            primitives: scene.primitives.filter((n) =>
                              n.presentationStep <= step
                            ),
                          }
                          : scene}
                        scope={scope}
                        functions={functions}
                        onChange={update}
                        onVariable={variable}
                        onSelect={setSelected}
                        selected={p.id === selectedId}
                        readOnly={presenting}
                      />
                    </Frame>
                  ))}
                </div>
              </div>
            )}
        </main>
      </div>
      <footer className="pc-bottom">
        <span>
          {scene.primitives.length} elementos · {scene.variables.length}{" "}
          variables
        </span>
        <button
          onClick={() => {
            let y = 24;
            commit({
              ...scene,
              primitives: scene.primitives.map((p) => {
                if ("canvasId" in p.data && p.data.canvasId) return p;
                const next = {
                  ...p,
                  x: 24,
                  y,
                  width: 1152,
                  rotation: 0,
                  autoHeight: true,
                };
                y += p.height + 24;
                return next;
              }),
            });
          }}
        >
          Organizar lienzo
        </button>
        <span className="pc-zoom">
          {narrow ? "Vista móvil" : (
            <>
              <button
                aria-label="Alejar"
                onClick={() => {
                  setAutoZoom(false);
                  setZoom((z) => Math.max(.4, z - .1));
                }}
              >
                −
              </button>
              {Math.round(zoom * 100)}%<button
                aria-label="Acercar"
                onClick={() => {
                  setAutoZoom(false);
                  setZoom((z) => Math.min(1.5, z + .1));
                }}
              >
                +
              </button>
              <button onClick={() => setAutoZoom(true)}>Ajustar</button>
            </>
          )}
        </span>
      </footer>
      {!presenting && (
        <button
          className="pc-chat-launcher"
          aria-label="Abrir chat de Fontex"
          onClick={() => {
            setTab("chat");
            setSidebar(true);
          }}
        >
          <MessageCircle size={20} />Chat
        </button>
      )}
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const input = e.target, f = input.files?.[0];
          if (f) {
            if (f.size > MAX_PRIMITIVE_BYTES) {
              setNotice("El archivo supera 1 MiB.");
              input.value = "";
              return;
            }
            void f.text().then((text) => {
              commit(parsePrimitiveScene(JSON.parse(text)));
              setSelected(null);
            }).catch(() =>
              setNotice("El archivo no es una escena de primitivas válida.")
            ).finally(() => {
              input.value = "";
            });
          }
        }}
      />
    </div>
  );
}
