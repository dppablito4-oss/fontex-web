import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

/** The camera is local to the view; navigating never edits a lesson or costs a credit. */
export function useWorkspaceViewport(stage: RefObject<HTMLDivElement | null>, narrow: boolean) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const space = useRef(false);
  const drag = useRef<{ x: number; y: number; start: typeof offset } | null>(null);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest("input,textarea,select,button,[contenteditable=true]")) {
        space.current = true;
        e.preventDefault();
      }
    };
    const up = () => { space.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", up);
    };
  }, []);
  useEffect(() => {
    const node = stage.current;
    if (!node || narrow) return;
    const wheel = (e: WheelEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || !(e.target as Element).closest(".pc-board-space") ||
        (e.target as Element).closest("input,textarea,select,.pc-plot-overlay")) return;
      e.preventDefault();
      const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? node.clientHeight : 1;
      setOffset((p) => ({ x: p.x - e.deltaX * factor, y: p.y - e.deltaY * factor }));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [stage, narrow]);
  function finish(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    setMoving(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return {
    offset, moving,
    reset: () => setOffset({ x: 0, y: 0 }),
    events: {
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        if (narrow || ![1, 2].includes(e.button) && !(space.current && e.button === 0) ||
          (e.target as Element).closest("input,textarea,select,button,a,.pc-plot-overlay")) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, start: offset };
        setMoving(true);
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (!d) return;
        e.stopPropagation();
        setOffset({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y });
      },
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: () => { drag.current = null; setMoving(false); },
      onContextMenu: (e: React.MouseEvent) => {
        if (!(e.target as Element).closest("input,textarea,a")) e.preventDefault();
      },
    },
  };
}
