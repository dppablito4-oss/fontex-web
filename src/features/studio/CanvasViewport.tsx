import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { GripHorizontal } from "lucide-react";
import {
  BOARD,
  fitObject,
  type MathObject,
} from "../../core/document-schema/document";
import { MathObjectRenderer } from "./MathObjectRenderer";

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
  const drag = useRef<{ object: MathObject; x: number; y: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<MathObject | null>(null);
  function start(event: PointerEvent, object: MathObject) {
    if (presenting || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { object, x: event.clientX, y: event.clientY };
    onSelect(object.id);
  }
  function dragged(event: PointerEvent) {
    const active = drag.current;
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
    if (next && original && (next.x !== original.x || next.y !== original.y))
      onChange(next);
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
              <span>Un espacio para tus ideas</span>
              <h2>Construye una explicación visual.</h2>
              <p>
                Añade una fracción, una operación guiada, un texto o una
                sucesión.
              </p>
            </div>
          )}
          {objects.map((object) => {
            const shown = preview?.id === object.id ? preview : object;
            return (
              <article
                key={object.id}
                className={`st-object st-object-${object.type} ${!presenting && selectedId === object.id ? "selected" : ""}`}
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
                <div className="st-object-content">
                  <MathObjectRenderer object={object} onChange={onChange} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
