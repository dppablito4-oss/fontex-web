import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChartColumn,
  ChartSpline,
  Grid2X2,
  LayoutGrid,
  MoveUpRight,
  Network,
  PenLine,
  Shapes,
  Type,
  type LucideIcon,
  FolderOpen,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Expand,
  Maximize2,
  Minimize2,
  LayoutDashboard,
  GripVertical,
  MessageCircle,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { SiteHeader } from "../../components/ProductNavigation";
import { useAuth } from "../auth/AuthProvider";
import { AuthLoadingPage } from "../auth/AuthPage";
import { useBetaAccess } from "../beta/useBetaAccess";
import { AcademicMarkdown } from "../tutor/components/AcademicMarkdown";
import { usePrimitiveStore } from "./usePrimitiveStore";
import { PrimitiveVisual } from "./PrimitiveVisual";
import { PrimitiveFields } from "./PrimitiveFields";
import { CanvasDocumentTabs, CanvasToolMenu } from "./CanvasWorkspaceControls";
import { canvasTabId } from "./canvas-tabs";
import { agentTask } from "../../core/agent/conversation";
import {
  applyPrimitivePatch,
  createPrimitive,
  MAX_PRIMITIVE_BYTES,
  newPrimitiveScene,
  nextSymbol,
  parsePrimitiveScene,
  type Primitive,
  type PrimitiveKind,
  primitiveNames,
  type PrimitiveScene,
} from "../../core/primitives/schema";
import { sceneFunctions, sceneScope } from "../../core/primitives/math";
import { templates, templateScene } from "../../core/primitives/templates";
import { requestPrimitiveAgent } from "./agent";
import { draggedRotation } from "./gestures";
import { organizePrimitiveScene, workspaceRoots } from "../../core/primitives/layout";
import { useWorkspaceViewport } from "./useWorkspaceViewport";
import { DockResizeHandle } from "./DockResizeHandle";
import { buildContent, getCanvasBuild, readPendingBuild, recoveredScene, savePendingBuild, type BuildReceipt } from "./buildRecovery";
import { useBuildRecovery } from "./useBuildRecovery";
import { GenerationProgress } from "./GenerationProgress";
import { VariableValueField } from "./VariableValueField";
import {
  advanceStep,
  presentationSteps,
} from "../../core/primitives/presentation";
import { useAiCredits } from "../ai-credits/useAiCredits";
import { creditsChanged } from "../ai-credits/service";
import "./primitives.css";
type Tab = "file" | "elements" | "templates" | "variables";
const primitiveIcons: Record<PrimitiveKind, LucideIcon> = {
  coordinate_canvas: Grid2X2,
  function_region: ChartSpline,
  vector_segment: MoveUpRight,
  stamp_grid: LayoutGrid,
  math_block: Type,
  control_slider: SlidersHorizontal,
  geometric_shape: Shapes,
  data_chart: ChartColumn,
  node_graph: Network,
  annotation_stroke: PenLine,
};
type DragKind = "move" | "resize" | "rotate";
type Drag = {
  kind: DragKind;
  centerX: number;
  centerY: number;
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
  scale,
}: {
  p: Primitive;
  children: React.ReactNode;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onDrag: (
    e: PointerEvent<HTMLButtonElement>,
    kind: DragKind,
    bounds?: DOMRect,
  ) => void;
  onFit: (id: string, height: number) => void;
  narrow: boolean;
  scale: number;
}) {
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLElement>(null);
  const [rotateHandle, setRotateHandle] = useState<
    { left: number; top: number; host: HTMLElement } | null
  >(null);
  useEffect(() => {
    const node = frame.current;
    const host = node?.closest<HTMLElement>(".pc-stage");
    if (!node || !host || !selected || !editing || narrow) return;
    const place = () => {
      const box = node.getBoundingClientRect(),
        stageBox = host.getBoundingClientRect();
      setRotateHandle(
        box.bottom < stageBox.top || box.top > stageBox.bottom ? null : {
          left: Math.max(
            stageBox.left + 4,
            Math.min(stageBox.right - 40, box.x + box.width / 2 - 18),
          ),
          top: Math.max(stageBox.top + 4, box.y - 38),
          host,
        },
      );
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node);
    observer.observe(host);
    host.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      host.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [
    selected,
    editing,
    narrow,
    scale,
    p.x,
    p.y,
    p.width,
    p.height,
    p.rotation,
  ]);
  useEffect(() => {
    const node = content.current;
    if (!node || narrow) return;
    const observer = new ResizeObserver(() => {
      const next = Math.ceil(node.scrollHeight + 24);
      if (
        (p.autoHeight && Math.abs(next - p.height) > 3) ||
        (!p.autoHeight && next > p.height + 3)
      ) {
        onFit(p.id, Math.max(100, Math.min(100000, next)));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [p.id, p.height, p.autoHeight, p.width, onFit, narrow]);
  return (
    <article
      ref={frame}
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
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onSelect();
        }
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
      {editing && selected && !narrow && rotateHandle && createPortal(
        <button
          className="pc-rotate"
          style={{ left: rotateHandle.left, top: rotateHandle.top }}
          aria-label="Girar objeto"
          title="Arrastra para girar. Shift ajusta a 15°"
          disabled={p.locked}
          onPointerDown={(e) =>
            onDrag(e, "rotate", frame.current?.getBoundingClientRect())}
        >
          <RotateCw size={18} />
        </button>,
        rotateHandle.host,
      )}
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
  const access = useBetaAccess();
  // A failed refresh is not a revocation. Remounting as "guest" here aborted
  // an in-flight generation and discarded its result after the server finished.
  // The API continues checking actual membership on every protected request.
  const participant = !!user && (access.status === "allowed" || access.lastVerifiedAllowed);
  if (user && access.status === "loading") return <AuthLoadingPage />;
  return (
    <Editor
      key={participant ? user.id : "guest"}
      owner={participant ? user.id : "guest"}
      authenticated={participant}
      accessNote={user && access.status === "error" ? "No se pudo actualizar la comprobación de acceso. Conservamos tu lienzo; reintenta si falla alguna acción." : user && !participant ? "Esta cuenta no tiene acceso remoto disponible. Puedes seguir creando en el lienzo local o consultar al administrador." : ""}
    />
  );
}
function Editor(
  { owner, authenticated, accessNote }: { owner: string; authenticated: boolean; accessNote: string },
) {
  const library = usePrimitiveStore(owner), { scene, setScene } = library;
  const credits = useAiCredits();
  const creditBlocked = authenticated &&
    (!credits.status || credits.status.balance < 1 ||
      credits.status.active_generation);
  const [selectedId, setSelected] = useState<string | null>(null),
    [tab, setTab] = useState<Tab | null>(null),
    [sidebar, setSidebar] = useState(() =>
      !window.matchMedia("(max-width:760px)").matches
    );
  const [dockView, setDockView] = useState<"chat" | "properties">("chat");
  const [focused, setFocused] = useState(false);
  const [dockWidth, setDockWidth] = useState(() => {
    try { return Math.max(300, Math.min(560, Number(localStorage.getItem("fontex-dock-width")) || 380)); }
    catch { return 380; }
  });
  const resizeDock = (width: number) => {
    setDockWidth(width);
    try { localStorage.setItem("fontex-dock-width", String(width)); } catch { /* Preference is optional. */ }
  };
  const closeTools = useCallback(() => setTab(null), []);
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
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const prompt = drafts[scene.id] ?? "";
  const promptTask = agentTask(prompt);
  const setPrompt = (value: string) => setDrafts((current) => ({ ...current, [scene.id]: value }));
  const [busyTask, setBusyTask] = useState<"chat" | "build" | null>(null),
    [streamText, setStreamText] = useState("");
  const busy = busyTask !== null;
  const level = scene.level;
  const [variableName, setVariableName] = useState("b"),
    [templateFilter, setTemplateFilter] = useState("");
  const variableBatch = useRef({ name: "", time: 0 });
  const viewportBatch = useRef({ id: "", time: 0 });
  const root = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    drag = useRef<Drag | null>(null),
    live = useRef(scene),
    abort = useRef<AbortController | null>(null),
    messageEnd = useRef<HTMLDivElement>(null);
  const viewport = useWorkspaceViewport(stage, narrow || presenting);
  const roots = workspaceRoots(scene);
  const boardWidth = Math.max(1200, ...roots.map((p) => p.x + p.width + 24));
  useEffect(() => {
    live.current = scene;
  }, [scene]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    messageEnd.current?.scrollIntoView({ block: "nearest" });
  }, [scene.conversation.length, streamText, sidebar, dockView]);
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
        setZoom(Math.min(1.5, (node.clientWidth - 32) / boardWidth));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoZoom, narrow, sidebar, focused, boardWidth]);
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
      if (!setScene(valid)) return false;
      if (history) {
        viewportBatch.current = { id: "", time: 0 };
        const previous = live.current;
        setPast((h) => [...h.slice(-39), previous]);
        setFuture([]);
      }
      live.current = valid;
      setNotice("");
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "El cambio no es válido.");
      return false;
    }
  }
  function recoverBuild(receipt: BuildReceipt, separate = false) {
    try {
      const next = recoveredScene(live.current, receipt, separate);
      if (!commit(next)) return false;
      savePendingBuild(owner, receipt.source.id, null);
      if (prompt.trim() === receipt.question) setPrompt("");
      viewport.reset(); setAutoZoom(true);
      setNotice(separate ? "Propuesta recuperada en otro lienzo. No se consumieron créditos." : "Construcción recuperada y aplicada. No se consumieron créditos adicionales.");
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo recuperar la construcción."); return false; }
  }
  const recovery = useBuildRecovery({ authenticated, scene, status: library.status, busy,
    current: () => live.current, apply: recoverBuild });
  function update(p: Primitive, history = true) {
    return commit({
      ...live.current,
      variables: p.kind === "control_slider" && p.data.controlType === "toggle"
        ? live.current.variables.map((v) =>
          v.name === p.data.variableName
            ? { ...v, value: Number(Boolean(v.value)), min: 0, max: 1, step: 1 }
            : v
        )
        : live.current.variables,
      primitives: live.current.primitives.map((old) =>
        old.id === p.id ? p : old
      ),
    }, history);
  }
  function navigatePlot(p: Extract<Primitive, { kind: "coordinate_canvas" }>) {
    // Called only by viewport input handlers; this time groups one gesture into one undo entry.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const history = viewportBatch.current.id !== p.id || now - viewportBatch.current.time > 700;
    if (update(p, history)) viewportBatch.current = { id: p.id, time: now };
  }
  const fit = useCallback((id: string, height: number) => {
    const current = live.current,
      p = current.primitives.find((n) => n.id === id);
    if (
      !p || Math.abs(p.height - height) < 4 ||
      (!p.autoHeight && height <= p.height)
    ) return;
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
          v.name === name ? { ...v, value, min: Math.min(v.min, value), max: Math.max(v.max, value) } : v
        ),
      });
      if (
        valid.variables.find((v) => v.name === name)?.value ===
          current.variables.find((v) => v.name === name)?.value
      ) return;
      const now = Date.now();
      viewportBatch.current = { id: "", time: 0 };
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
    viewportBatch.current = { id: "", time: 0 };
    const previous = past.at(-1);
    if (previous) {
      const current = live.current;
      setFuture((h) => [current, ...h]);
      setPast((h) => h.slice(0, -1));
      commit(previous, false);
    }
  }
  function redo() {
    variableBatch.current = { name: "", time: 0 };
    viewportBatch.current = { id: "", time: 0 };
    const next = future[0];
    if (next) {
      const current = live.current;
      setPast((h) => [...h, current]);
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
  const steps = useMemo(() => presentationSteps(scene), [scene]);
  const stepIndex = Math.max(0, steps.indexOf(step));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      ) return;
      if (e.key === "Escape") {
        setFocused(false);
        setSelected(null);
        setPresenting(false);
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        }
      }
      if (presenting && ["ArrowRight", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        setStep((s) => advanceStep(s, e.key === "ArrowRight" ? 1 : -1, steps));
      }
      if (presenting && (e.key === "Home" || e.key === "End")) {
        e.preventDefault();
        setStep(e.key === "Home" ? steps[0]! : steps.at(-1)!);
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
      selectPrimitive(p.id);
    }
  }
  function beginDrag(
    e: PointerEvent<HTMLButtonElement>,
    kind: DragKind,
    p: Primitive,
    frameBounds?: DOMRect,
  ) {
    if (p.locked || narrow || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const bounds = frameBounds ??
      e.currentTarget.closest(".pc-object")!.getBoundingClientRect();
    drag.current = {
      kind,
      centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2,
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
    const p = d.kind === "rotate"
      ? {
        ...d.old,
        rotation: draggedRotation(
          d.old.rotation,
          [d.centerX, d.centerY],
          [d.x, d.y],
          [e.clientX, e.clientY],
          e.shiftKey,
        ),
      }
      : d.kind === "move"
      ? {
        ...d.old,
        x: Math.max(0, Math.min(10000, d.old.x + dx)),
        y: Math.max(0, d.old.y + dy),
      }
      : {
        ...d.old,
        width: Math.max(100, Math.min(1600, d.old.width + dx)),
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
  function selectPrimitive(id: string) {
    setSelected(id);
    const item = live.current.primitives.find((p) => p.id === id);
    if (!(item && "canvasId" in item.data && item.data.canvasId)) {
      setSidebar(true);
      setDockView("properties");
    }
    setTab(null);
  }
  function load(id: string) {
    const template = templateScene(id);
    if (!live.current.primitives.length && !live.current.conversation.length) template.id = live.current.id;
    if (commit(template)) {
      setSelected(null);
      setStep(1);
      setDockView("chat");
      setTab(null);
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
        "Inicia sesión para conversar con Fontex AI. Puedes crear con las plantillas y los diez elementos sin usar IA.",
      );
      return;
    }
    if (task === "build" && credits.status?.balance === 0) {
      setNotice(
        "No tienes créditos para generar. El chat sigue disponible; puedes pedir más saldo al administrador.",
      );
      return;
    }
    const before = live.current, controller = new AbortController();
    abort.current = controller;
    setBusyTask(task);
    setStreamText("");
    setNotice("");
    setPrompt("");
    let requestId: string | undefined;
    if (task === "build") {
      try {
        const previous = readPendingBuild(owner, before.id);
        if (previous && previous.question === question.trim()) {
          const receipt = await getCanvasBuild(previous.id);
          if (receipt?.state === "ready") {
            recoverBuild(receipt);
            setBusyTask(null); abort.current = null; return;
          }
          if (receipt?.state === "pending") throw Error("La construcción sigue en curso. Su resultado aparecerá aquí al completarse, sin volver a cobrar.");
          if (!receipt && previous.content === buildContent(before)) requestId = previous.id;
        }
        requestId ??= crypto.randomUUID();
        if (controller.signal.aborted || live.current.id !== before.id) {
          setBusyTask(null); abort.current = null; return;
        }
        savePendingBuild(owner, before.id, { id: requestId, question: question.trim(), content: buildContent(before) });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "No se pudo comprobar la construcción pendiente.");
        setBusyTask(null); setPrompt(question); abort.current = null; return;
      }
    }
    const last = before.conversation.at(-1);
    const turns =
      (last?.role === "user" && last.content === question.trim()
        ? before.conversation
        : [...before.conversation, {
          role: "user" as const,
          content: question.trim(),
        }]).slice(-78);
    if (!commit({ ...before, conversation: turns }, false)) {
      setBusyTask(null);
      setPrompt(question);
      return;
    }
    try {
      const reply = await requestPrimitiveAgent(
        { scene: before, question: question.trim(), task, level, selectedId, ...(requestId ? { requestId } : {}) },
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
      if (task === "build" && (!reply.actions.length || (!before.primitives.length && !patched.primitives.length))) {
        throw Error("La respuesta no incluyó elementos para construir. Tu lienzo sigue intacto.");
      }
      if (task === "chat" && reply.actions.length) {
        throw Error("La conversación devolvió cambios inesperados.");
      }
      const applied = commit({
        ...(task === "build" && before.primitives.length === 0 ? organizePrimitiveScene(patched) : patched),
        conversation: [...turns, {
          role: "assistant" as const,
          content: reply.message,
        }].slice(-80),
        ...(requestId ? { appliedBuildIds: [...(before.appliedBuildIds ?? []), requestId].slice(-100) } : {}),
      }, task === "build");
      if (!applied) throw Error("La respuesta se recibió, pero no pudo guardarse en el lienzo. Conserva esta pestaña y revisa el aviso de guardado.");
      if (task === "build") {
        savePendingBuild(owner, before.id, null);
        setNotice(`Construcción aplicada al lienzo: ${patched.primitives.length} elementos.`);
        if (!before.primitives.length) {
          setAutoZoom(true);
          viewport.reset();
          stage.current?.scrollTo({ top: 0, left: 0 });
        }
      }
    } catch (e) {
      setNotice(
        controller.signal.aborted
          ? "La generación se detuvo. Puedes volver a intentarlo."
          : e instanceof Error
          ? e.message
          : "La respuesta no se completó. Tu lienzo sigue intacto.",
      );
      setPrompt(question);
    } finally {
      if (task === "build") creditsChanged();
      setBusyTask(null);
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
    if (p.kind === "data_chart" && p.data.chartType === "matrix") {
      p.data.matrixName = nextSymbol(scene, p.data.matrixName ?? "m");
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
  const height = Math.max(700, ...roots.map((p) => p.y + p.height + 40));
  function resetEditor() {
    viewport.reset();
    setSelected(null); setPast([]); setFuture([]); setStep(1); setDockView("chat");
  }
  function openScene(id: string) {
    if (id === scene.id) return;
    abort.current?.abort();
    library.open(id);
    resetEditor();
    closeTools();
  }
  function newScene() {
    abort.current?.abort();
    const next = newPrimitiveScene(`Lienzo ${library.scenes.length + 1}`);
    if (setScene(next)) { live.current = next; resetEditor(); closeTools(); }
  }
  function toggleTools(tool: Tab) { setTab((current) => current === tool ? null : tool); }
  const toolContent = (
                <div className="pc-panel-content">
                  {tab === "elements" && (
                    <>
                      <h2>Combina elementos</h2>
                      <p>Diez elementos que puedes combinar.</p>
                      <div className="pc-element-list">
                        {(Object.keys(primitiveNames) as PrimitiveKind[]).map((kind) => {
                          const Icon = primitiveIcons[kind];
                          return (
                          <button
                            key={kind}
                            onClick={() => add(kind)}
                          >
                            <span aria-hidden="true">
                              <Icon size={19} />
                            </span>
                            <strong>{primitiveNames[kind]}</strong>
                            <Plus size={16} />
                          </button>
                        ); })}
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
                                setDockView("properties");
                                setSidebar(true);
                                setTab(null);
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
                            data-module={t.id === "fractions" ? "orange" : "green"}
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
                          <VariableValueField variable={v} onChange={variable} />
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
  );
  return (
    <div
      className={`pc-app${focused ? " pc-focused" : ""}${presenting ? " pc-presenting" : ""}${
        sidebar ? " pc-sidebar-open" : ""
      }`}
      ref={root}
      onPointerMove={move}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <SiteHeader />
      <CanvasDocumentTabs scenes={library.scenes} activeId={scene.id} onOpen={openScene} onNew={newScene} />
      <header className="pc-topbar" aria-label="Herramientas del lienzo">
        <div className="pc-toolbar-menus">
          <CanvasToolMenu label="Archivo" icon={<FolderOpen size={16} />} open={tab === "file"} onToggle={() => toggleTools("file")} onClose={closeTools}>
            <div className="pc-file-menu">
              <label>Título del lienzo<input aria-label="Título del lienzo" value={scene.title} maxLength={160} onChange={(e) => commit({ ...scene, title: e.target.value })} /></label>
              <button onClick={newScene}><Plus size={16} />Nuevo lienzo</button>
              <button onClick={() => { closeTools(); file.current?.click(); }}><FolderOpen size={16} />Abrir JSON</button>
              <button onClick={() => { download(); closeTools(); }}><Download size={16} />Guardar JSON</button>
              <button onClick={() => { closeTools(); setSelected(null); window.print(); }}><Download size={16} />Exportar PDF</button>
              <button className="pc-delete-document" disabled={busy || library.status === "saving" || library.status === "loading"} onClick={() => {
                if (!window.confirm(`¿Eliminar el lienzo «${scene.title || "Sin título"}»? Guarda un JSON si necesitas conservar una copia.`)) return;
                closeTools();
                void library.remove(scene.id).then((removed) => { if (removed) resetEditor(); });
              }}><Trash2 size={16} />Eliminar lienzo</button>
            </div>
          </CanvasToolMenu>
          {(["elements", "templates", "variables"] as const).map((tool) => <CanvasToolMenu key={tool}
            label={{elements:"Elementos",templates:"Plantillas",variables:"Variables"}[tool]}
            icon={tool === "elements" ? <Plus size={16} /> : tool === "templates" ? <LayoutDashboard size={16} /> : <SlidersHorizontal size={16} />}
            open={tab === tool} onToggle={() => toggleTools(tool)} onClose={closeTools}
          >{toolContent}</CanvasToolMenu>)}
        </div>
        <div className="pc-history-actions">
          <button aria-label="Deshacer" title="Deshacer" disabled={!past.length} onClick={undo}><Undo2 size={16} /></button>
          <button aria-label="Rehacer" title="Rehacer" disabled={!future.length} onClick={redo}><Redo2 size={16} /></button>
        </div>
        <span className="pc-save" role="status"><Check size={13} />{library.status === "saved" ? "Guardado en tu cuenta" : library.status === "local" ? "Guardado local" : library.status === "saving" || library.status === "loading" ? "Sincronizando…" : "Sincronización pendiente"}</span>
        <div className="pc-top-actions">
          <button aria-label={focused ? "Restaurar espacio de trabajo" : "Ampliar lienzo"} aria-pressed={focused} title="Ampliar lienzo · Escape para volver" onClick={() => setFocused(!focused)}>{focused ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          <button aria-pressed={sidebar && dockView === "chat"} onClick={() => { setDockView("chat"); setSidebar(!sidebar || dockView !== "chat"); closeTools(); }}><MessageCircle size={16} /><span>Asistente</span></button>
          <button className="pc-present-action" disabled={!scene.primitives.length} onClick={() => {
            closeTools(); setSelected(null); setStep(steps[0]!); setPresenting(true);
            void root.current?.requestFullscreen?.().catch(() => {});
          }}><Expand size={16} /><span>Presentar</span></button>
        </div>
      </header>
      {(notice || library.notice || accessNote) && (
        <div className="pc-banner" role="status">
          {notice || library.notice || accessNote}
          <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {!busy && recovery.available.map((receipt) => <div className="pc-banner" key={receipt.id} role="status">
        Hay una propuesta completada sobre una versión anterior de este lienzo.
        <button onClick={() => recoverBuild(receipt, true)}>Recuperar en otro lienzo · sin crédito</button>
      </div>)}
      {recovery.error && <p className="pc-recovery-note" role="status">{recovery.error}</p>}
      {presenting && (
        <nav className="pc-present-bar">
          <strong>{scene.title}</strong>
          <span>Paso {stepIndex + 1} de {steps.length}</span>
          <progress
            aria-label="Avance de presentación"
            value={stepIndex + 1}
            max={steps.length}
          />
          <button
            disabled={stepIndex === 0}
            aria-label="Paso anterior"
            onClick={() => setStep((s) => advanceStep(s, -1, steps))}
          >
            <ChevronLeft />
          </button>
          <button
            disabled={stepIndex === steps.length - 1}
            aria-label="Paso siguiente"
            onClick={() => setStep((s) => advanceStep(s, 1, steps))}
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
      <div className="pc-shell" id="canvas-workspace" role="tabpanel" aria-labelledby={canvasTabId(scene.id)}>
        <main
          aria-label="Lienzo matemático"
          className={`pc-stage${viewport.moving ? " pc-camera-moving" : ""}`}
          ref={stage}
          {...viewport.events}
          onClick={() => setSelected(null)}
        >
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
                      data-module={id === "fractions" ? "orange" : "green"}
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
                  }}
                >
                  <Plus size={17} />Explorar los diez elementos
                </button>
              </div>
            )
            : (
              <div
                className="pc-board-space"
                style={{
                  width: narrow ? "100%" : boardWidth * zoom,
                  height: narrow ? "auto" : height * zoom,
                  transform: narrow || presenting ? undefined : `translate(${viewport.offset.x}px, ${viewport.offset.y}px)`,
                }}
              >
                <div
                  className="pc-board"
                  style={{
                    width: narrow ? "100%" : boardWidth,
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
                        if (!presenting) selectPrimitive(p.id);
                      }}
                      onDrag={(e, kind, bounds) =>
                        beginDrag(e, kind, p, bounds)}
                      onFit={fit}
                      narrow={narrow}
                      scale={zoom}
                    >
                      <PrimitiveVisual
                        p={p}
                        scene={scene}
                        visibleStep={presenting ? step : undefined}
                        displayScale={narrow ? 1 : zoom}
                        scope={scope}
                        functions={functions}
                        onChange={update}
                        onViewportChange={navigatePlot}
                        onVariable={variable}
                        onSelect={selectPrimitive}
                        selected={p.id === selectedId}
                        selectedId={selectedId}
                        readOnly={presenting}
                      />
                    </Frame>
                  ))}
                </div>
              </div>
            )}
        </main>

        {sidebar && narrow && !presenting && !focused && (
          <button
            className="pc-dock-backdrop"
            aria-label="Cerrar panel y volver al lienzo"
            onClick={() => setSidebar(false)}
          />
        )}
        {sidebar && !presenting && !focused && (
          <aside className="pc-sidebar" style={narrow ? undefined : { width: dockWidth }} aria-label="Panel de Fontex">
            {!narrow && <DockResizeHandle width={dockWidth} onChange={resizeDock} />}
            <header>
              <strong><MessageCircle size={17} />{dockView === "properties" && selected ? "Propiedades" : "Fontex Agente"}</strong>
              <button aria-label="Cerrar panel" onClick={() => setSidebar(false)}><X size={17} /></button>
            </header>
            {selected && <nav className="pc-dock-tabs" aria-label="Vista del panel">
              <button aria-pressed={dockView === "chat"} onClick={() => setDockView("chat")}><MessageCircle size={15} />Chat</button>
              <button aria-pressed={dockView === "properties"} onClick={() => setDockView("properties")}><SlidersHorizontal size={15} />Propiedades</button>
            </nav>}
            {dockView === "properties" && selected ? (
            <section className="pc-inspector" aria-label="Propiedades del elemento">
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
                          style: {
                            ...selected.style,
                            fillColor: e.target.value,
                          },
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
                    onClick={() => { setSelected(null); setDockView("chat"); }}
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
                              ...(key === "height"
                                ? { autoHeight: false }
                                : {}),
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
            </section>
            ) : (<>
                  {authenticated && (
                    <details className="pc-credit-info">
                      <summary>
                        {credits.status
                          ? `${credits.status.balance} créditos para generar`
                          : credits.error ?? "Consultando saldo…"}
                      </summary>
                      <small>
                        Chat sin cobro, con límites de uso. Crear en el lienzo consume 1 crédito.
                      </small>
                      {credits.status?.balance === 0 && (
                        <span>Sin saldo: puedes seguir conversando.</span>
                      )}
                      {credits.status?.active_generation && (
                        <small>Hay una generación en curso.</small>
                      )}
                      {credits.error && (
                        <button onClick={() => void credits.refresh()}>
                          Reintentar saldo
                        </button>
                      )}
                      {credits.status?.is_admin && (
                        <a href="#/administracion">Administrar créditos</a>
                      )}
                    </details>
                  )}
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
                            disabled={busy || creditBlocked}
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
                        {turn.role === "user" && i === scene.conversation.length - 1 && !busy && agentTask(turn.content) === "build" && (
                          <button aria-label="Reintentar construcción" disabled={creditBlocked} onClick={() => void ask("build", turn.content)}>
                            <Plus size={15} />Reintentar construcción · 1 crédito
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
                        <GenerationProgress building={busyTask === "build"} />
                      </div>
                    )}
                    <div ref={messageEnd} />
                  </div>
                  <form
                    className="pc-chat-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void ask(promptTask);
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
                      rows={2}
                    />
                    <div>
                      {promptTask === "chat" && <button
                        type="button"
                        disabled={busy || creditBlocked || !prompt.trim()}
                        onClick={() => void ask("build")}
                      >
                        <Plus size={16} />Crear con IA
                      </button>}
                      <button
                        type="submit"
                        className="pc-primary"
                        disabled={busy || !prompt.trim() || (promptTask === "build" && creditBlocked)}
                      >
                        <Send size={16} />{busyTask === "build" ? "Construyendo…" : promptTask === "build" ? "Crear en el lienzo" : "Enviar"}
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
                    {promptTask === "build" && !busy && <small className="pc-generation-hint">Crear en el lienzo consume 1 crédito.</small>}
                  </form>
            </>)}
          </aside>
        )}


      </div>
      <footer className="pc-bottom">
        <span>
          {scene.primitives.length} elementos · {scene.variables.length}{" "}
          variables
        </span>
        <button
          onClick={() => {
            commit(organizePrimitiveScene(scene));
            setAutoZoom(true);
          }}
        >
          <LayoutDashboard size={16} />Organizar lienzo
        </button>
        <span className="pc-zoom">
          <span>Zoom del lienzo</span>
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
              <button onClick={() => { setAutoZoom(true); viewport.reset(); }}>Ajustar ancho</button>
            </>
          )}
        </span>
      </footer>
      {!presenting && (
        <button
          className="pc-chat-launcher"
          aria-label="Abrir chat de Fontex"
          onClick={() => {
            setDockView("chat");
            setSidebar(true);
            setSelected(null);
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
