import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { GripHorizontal, Maximize2, MoveDiagonal2, X } from "lucide-react";
import {
  BOARD,
  fitObject,
  type MathObject,
} from "../../core/document-schema/document";
import { MathObjectRenderer } from "./MathObjectRenderer";
import { resizeObject } from "./object-layout";

export function CanvasViewport({
  objects,
  selectedId,
  zoom,
  presenting,
  onSelect,
  onChange,
  onDelete,
  children,
}: {
  objects: MathObject[];
  selectedId: string | null;
  zoom: number;
  presenting: boolean;
  onSelect: (id: string | null) => void;
  onChange: (object: MathObject) => void;
  onDelete: (id: string) => void;
  children?: ReactNode;
}) {
  const drag = useRef<
    { object: MathObject; x: number; y: number; resizing: boolean } | null
  >(
    null,
  );
  const [preview, setPreview] = useState<MathObject | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const expanded = objects.find((object) => object.id === expandedId);
  useEffect(() => {
    const modal = dialog.current;
    if (expanded && modal && !modal.open) modal.showModal();
    else if (!expanded && modal?.open) modal.close();
  }, [expanded]);
  function start(event: PointerEvent, object: MathObject, resizing = false) {
    if (presenting || event.button !== 0) return;
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
    if (presenting) return;
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
    <div className="st-viewport" onClick={() => onSelect(null)}>
      <div
        className="st-board-space"
        style={{ width: BOARD.width * zoom, height: BOARD.height * zoom }}
      >
        <div
          className="st-board"
          style={{
            width: BOARD.width,
            height: BOARD.height,
            transform: `scale(${zoom})`,
          }}
        >
          {objects.length === 0 && (
            <div className="st-empty-board">
              <h2>Nuevo material</h2>
              <p>Añade un objeto para comenzar.</p>
            </div>
          )}
          {objects.map((object) => {
            const shown = preview?.id === object.id ? preview : object;
            return (
              <article
                key={object.id}
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
                <div
                  className="st-object-handle"
                  role={presenting ? undefined : "button"}
                  tabIndex={presenting ? undefined : 0}
                  aria-label={presenting ? undefined : `Mover ${object.label}`}
                  onDoubleClick={() => setExpandedId(object.id)}
                  onFocus={() => {
                    if (!presenting) onSelect(object.id);
                  }}
                  onPointerDown={(event) => start(event, object)}
                  onPointerMove={move}
                  onPointerUp={finish}
                  onPointerCancel={() => {
                    drag.current = null;
                    setPreview(null);
                  }}
                  onKeyDown={(event) => keyboard(event, object)}
                >
                  <span>{object.label}</span>
                  {!presenting && <GripHorizontal size={18} />}
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
                  <MathObjectRenderer object={object} onChange={onChange} />
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
              <MathObjectRenderer object={expanded} onChange={onChange} />
            </div>
          </>
        )}
      </dialog>
      {children}
    </div>
  );
}
