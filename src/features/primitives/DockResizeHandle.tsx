import { useRef } from "react";

export function DockResizeHandle({ width, onChange }: { width: number; onChange: (width: number) => void }) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const resize = (value: number) => onChange(Math.max(300, Math.min(560, window.innerWidth * .55, value)));
  return <div className="pc-dock-resizer" role="separator" tabIndex={0} aria-label="Ancho del panel"
    aria-orientation="vertical" aria-valuenow={Math.round(width)} aria-valuemin={300} aria-valuemax={Math.min(560, Math.floor(window.innerWidth * .55))}
    onKeyDown={(e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        resize(e.key === "Home" ? 300 : e.key === "End" ? 560 : width + (e.key === "ArrowLeft" ? 20 : -20));
      }
    }}
    onPointerDown={(e) => { if (e.button) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, width }; }}
    onPointerMove={(e) => { if (drag.current) resize(drag.current.width + drag.current.x - e.clientX); }}
    onPointerUp={(e) => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
    onPointerCancel={() => { drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }}
  />;
}
