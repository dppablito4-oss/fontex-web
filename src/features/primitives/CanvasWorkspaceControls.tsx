import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { canvasTabId } from "./canvas-tabs";

export function CanvasDocumentTabs({ scenes, activeId, onOpen, onNew, onClose }: {
  scenes: { id: string; title: string }[];
  activeId: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose?: (id: string) => void;
}) {
  const active = useRef<HTMLButtonElement | null>(null);
  const [order, setOrder] = useState(() => scenes.map((scene) => scene.id));
  const ids = new Set(scenes.map((scene) => scene.id));
  const nextOrder = [...order.filter((id) => ids.has(id)), ...scenes.filter((scene) => !order.includes(scene.id)).map((scene) => scene.id)];
  // Metadata refreshes can arrive in updated-at order. Only membership changes
  // alter tab order, so renaming or saving a document never moves its tab.
  if (nextOrder.length !== order.length || nextOrder.some((id, index) => id !== order[index])) setOrder(nextOrder);
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const ordered = [...order.filter((id) => byId.has(id)).map((id) => byId.get(id)!), ...scenes.filter((scene) => !order.includes(scene.id))];
  useEffect(() => { active.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [activeId]);
  return <div className="pc-document-strip">
    <div className="pc-document-tabs" role="tablist" aria-label="Lienzos">
      {ordered.map((scene, index) => <div className="pc-document-tab" key={scene.id}><button
        key={scene.id}
        ref={scene.id === activeId ? active : undefined}
        id={canvasTabId(scene.id)}
        role="tab"
        aria-selected={scene.id === activeId}
        aria-controls="canvas-workspace"
        tabIndex={scene.id === activeId ? 0 : -1}
        title={scene.title || "Sin título"}
        onClick={() => onOpen(scene.id)}
        onKeyDown={(event) => {
          let next: number;
          if (event.key === "ArrowRight") next = (index + 1) % ordered.length;
          else if (event.key === "ArrowLeft") next = (index + ordered.length - 1) % ordered.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = ordered.length - 1;
          else return;
          event.preventDefault();
          const buttons = event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
          buttons?.[next]?.focus();
          onOpen(ordered[next]!.id);
        }}
      ><span className="pc-document-indicator" aria-hidden="true" /><span>{scene.title || "Sin título"}</span></button>
        {onClose && <button className="pc-close-tab" aria-label={`Cerrar ${scene.title || "Sin título"}`} onClick={() => onClose(scene.id)}><X size={13} /></button>}
      </div>)}
    </div>
    <button className="pc-new-document" onClick={onNew} aria-label="Nuevo lienzo" title="Nuevo lienzo"><Plus size={17} /></button>
  </div>;
}

export function CanvasToolMenu({ label, icon, open, onToggle, onClose, children }: {
  label: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const id = useId(), container = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const box = button.current?.getBoundingClientRect(), node = panel.current;
      if (!box || !node) return;
      const width = Math.min(440, window.innerWidth - 24);
      node.style.width = `${width}px`;
      node.style.left = `${Math.max(12, Math.min(box.left, window.innerWidth - width - 12))}px`;
      node.style.top = `${box.bottom + 8}px`;
      node.style.maxHeight = `${Math.max(64, window.innerHeight - box.bottom - 24)}px`;
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
      button.current?.focus();
    };
    place();
    panel.current?.querySelector<HTMLElement>('input,button,select,textarea,[tabindex="0"]')?.focus();
    document.addEventListener("pointerdown", outside);
    container.current?.addEventListener("keydown", escape);
    window.addEventListener("resize", place);
    const node = container.current;
    return () => {
      document.removeEventListener("pointerdown", outside);
      node?.removeEventListener("keydown", escape);
      window.removeEventListener("resize", place);
    };
  }, [open, onClose]);
  return <div className="pc-tool-menu" ref={container} onBlur={(event) => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) onClose();
  }}>
    <button ref={button} aria-expanded={open} aria-controls={id} onClick={onToggle}>
      {icon}<span>{label}</span><ChevronDown size={13} className="pc-menu-chevron" />
    </button>
    {open && <div id={id} ref={panel} className="pc-tool-popover" role="region" aria-label={label}>
      {children}
    </div>}
  </div>;
}
