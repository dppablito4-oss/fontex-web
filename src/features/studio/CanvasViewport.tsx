import { useCanvasGestures } from "./useCanvasGestures";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Copy, Trash2, GripHorizontal, Maximize2, MoveDiagonal2, X } from "lucide-react";
import {
  BOARD,
  boardHeight,
  fitObject,
  type MathObject,
  type ObjectType,
} from "../../core/document-schema/document";
import { InlineEditingContext, type InlineEditing } from "./inline-editing-context";
import { InlineValue } from "./InlineValue";
import { CanvasWelcome } from "./CanvasWelcome";
import { GuidedObject } from "./GuidedObject";
import { useContext } from "react";
import { TeachingMode } from "./teaching-mode";
import { resizeObject } from "./object-layout";

export function CanvasViewport({
  objects,
  selectedId,
  zoom,
  presenting,
  onSelect,
  onChange,
  onInlineChange,
  onDelete,
  onAdd,
  onBrowse,
  onDuplicate,
  onBeginEdit,
  onEndEdit,
  onCancelEdit,
  children,
  onZoom,
}: {
  objects: MathObject[];
  selectedId: string | null;
  zoom: number;
  presenting: boolean;
  onSelect: (id: string | null) => void;
  onChange: (object: MathObject) => void;
  onInlineChange?: (object: MathObject) => void;
  onDelete: (id: string) => void;
  onAdd?: (type: ObjectType) => void;
  onBrowse?: () => void;
  onDuplicate?: (object: MathObject) => void;
  onBeginEdit?: () => void;
  onEndEdit?: () => void;
  onCancelEdit?: () => void;
  children?: ReactNode;
  onZoom?: (zoom: number) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  useCanvasGestures(viewport, zoom, onZoom);
  const mode = useContext(TeachingMode);
  const empty = !objects.length && !presenting;
  const editable = !presenting && mode !== "practice";
  const editing = (object: MathObject): InlineEditing | null => editable ? { object, onChange: onInlineChange ?? onChange, onBegin: onBeginEdit, onEnd: onEndEdit, onCancel: onCancelEdit } : null;
  const drag = useRef<
    { object: MathObject; x: number; y: number; resizing: boolean } | null
  >(
    null,
  );
  const [preview, setPreview] = useState<MathObject | null>(null);
  const height = boardHeight(preview ? objects.map(o => o.id === preview.id ? preview : o) : objects);
  useEffect(() => {
    const element = viewport.current, object = objects.find(o => o.id === selectedId);
    if (!element?.clientWidth || !object) return;
    const top = object.y * zoom, left = object.x * zoom;
    if (top < element.scrollTop || top > element.scrollTop + element.clientHeight - 80) element.scrollTop = Math.max(0, top - 24);
    if (left < element.scrollLeft || left > element.scrollLeft + element.clientWidth - 80) element.scrollLeft = Math.max(0, left - 24);
  }, [selectedId, objects, zoom]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const expanded = objects.find((object) => object.id === expandedId);
  useEffect(() => {
    const modal = dialog.current;
    if (expanded && modal && !modal.open) modal.showModal();
    else if (!expanded && modal?.open) modal.close();
  }, [expanded]);
  function start(event: PointerEvent, object: MathObject, resizing = false) {
    if (presenting || event.button !== 0 || (event.target as HTMLElement).closest("input, textarea, select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { object, x: event.clientX, y: event.clientY, resizing };
    onSelect(object.id);
  }
  function dragged(event: PointerEvent) {
    const active = drag.current;
    if (active?.resizing) {
      return resizeObject(
        active.object,
        active.object.width + (event.clientX - active.x) / zoom,
        active.object.height + (event.clientY - active.y) / zoom,
      );
    }
    return active
      ? fitObject({
        ...active.object,
        x: active.object.x + (event.clientX - active.x) / zoom,
        y: active.object.y + (event.clientY - active.y) / zoom,
      })
      : null;
  }
  function move(event: PointerEvent) {
    const next = dragged(event);
    if (next) setPreview(next);
  }
  function finish(event: PointerEvent) {
    const next = dragged(event),
      original = drag.current?.object;
    drag.current = null;
    setPreview(null);
    if (
      next && original &&
      (next.x !== original.x || next.y !== original.y ||
        next.width !== original.width || next.height !== original.height)
    ) {
      onChange(next);
    }
  }
  function resizeKeyboard(event: KeyboardEvent, object: MathObject) {
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 100 : 20;
    const next = resizeObject(
      object,
      object.width + direction[0]! * step,
      object.height + direction[1]! * step,
    );
    if (next.width !== object.width || next.height !== object.height) {
      onChange(next);
    }
  }
  function keyboard(event: KeyboardEvent, object: MathObject) {
    if (presenting || (event.target as HTMLElement).closest("input, textarea, select")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(object.id);
    }
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (direction) {
      event.preventDefault();
      onChange(
        fitObject({
          ...object,
          x: object.x + direction[0]! * (event.shiftKey ? 50 : 10),
          y: object.y + direction[1]! * (event.shiftKey ? 50 : 10),
        }),
      );
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDelete(object.id);
    }
  }
  return (
    <div ref={viewport} className={`st-viewport ${empty ? "st-viewport-empty" : ""}`} onClick={() => onSelect(null)}>
      {empty && <CanvasWelcome onAdd={onAdd} onBrowse={onBrowse} />}
      <div
        className="st-board-space"
        hidden={empty}
        style={{ width: BOARD.width * zoom, height: height * zoom }}
      >
        <div
          className="st-board"
          style={{
            width: BOARD.width,
            height,
            transform: `scale(${zoom})`,
          }}
        >
          {objects.map((object) => {
            const shown = preview?.id === object.id ? preview : object;
            return (
              <InlineEditingContext.Provider key={object.id} value={editing(object)}>
              <article
                className={`st-object st-object-${object.type} ${
                  !presenting && selectedId === object.id ? "selected" : ""
                }`}
                style={{
                  left: shown.x,
                  top: shown.y,
                  width: shown.width,
                  height: shown.height,
                }}
                aria-label={object.label || "Objeto matemático"}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!presenting) onSelect(object.id);
                }}
              >
                <div className="st-object-handle" onDoubleClick={() => setExpandedId(object.id)}>
                  <span><InlineValue field="label" value={object.label} /></span>
                  {!presenting && <div className="st-canvas-object-actions">
                    {onDuplicate && <button aria-label={`Duplicar ${object.label}`} title="Duplicar" onClick={event => { event.stopPropagation(); onDuplicate(object); }}><Copy size={14} /></button>}
                    <button aria-label={`Eliminar ${object.label}`} title="Eliminar" onClick={event => { event.stopPropagation(); onDelete(object.id); }}><Trash2 size={14} /></button>
                  </div>}
                  {!presenting && <button
                    className="st-object-drag"
                    aria-label={`Mover ${object.label}`}
                    title="Arrastra para mover; también puedes usar las flechas del teclado"
                    onFocus={() => onSelect(object.id)}
                    onPointerDown={event => start(event, object)}
                    onPointerMove={move}
                    onPointerUp={finish}
                    onPointerCancel={() => { drag.current = null; setPreview(null); }}
                    onKeyDown={event => keyboard(event, object)}
                  ><GripHorizontal size={18} /></button>}
                </div>
                <button
                  className="st-object-expand"
                  aria-label={`Ampliar ${object.label}`}
                  title="Ampliar módulo"
                  onClick={() => setExpandedId(object.id)}
                >
                  <Maximize2 size={16} />
                </button>
                <div className="st-object-content">
                  <GuidedObject key={`${object.id}:${mode}`} object={object} />
                  {!presenting && mode === "practice" && <small>Para editar los datos, cambia a Aprender o Resolver.</small>}
                </div>
                {!presenting && (
                  <button
                    className="st-resize-handle"
                    aria-label={`Cambiar tamaño de ${object.label}`}
                    title="Cambiar tamaño"
                    onPointerDown={(event) => start(event, object, true)}
                    onPointerMove={move}
                    onPointerUp={finish}
                    onPointerCancel={() => {
                      drag.current = null;
                      setPreview(null);
                    }}
                    onKeyDown={(event) => resizeKeyboard(event, object)}
                  >
                    <MoveDiagonal2 size={16} />
                  </button>
                )}
              </article>
              </InlineEditingContext.Provider>
            );
          })}
        </div>
      </div>
      <dialog
        ref={dialog}
        className="st-object-dialog"
        aria-label={expanded
          ? `Vista ampliada: ${expanded.label}`
          : "Vista ampliada"}
        onClose={() => setExpandedId(null)}
        onClick={(event) => event.stopPropagation()}
      >
        {expanded && (
          <>
            <div className="st-dialog-heading">
              <h2>{expanded.label}</h2>
              <button
                aria-label="Cerrar vista ampliada"
                onClick={() => setExpandedId(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="st-expanded-content">
              <InlineEditingContext.Provider value={editing(expanded)}><GuidedObject key={`${expanded.id}:${mode}`} object={expanded} /></InlineEditingContext.Provider>
            </div>
          </>
        )}
      </dialog>
      {children}
    </div>
  );
}
