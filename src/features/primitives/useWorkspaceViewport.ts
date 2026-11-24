import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

export const MIN_CANVAS_ZOOM = .1;
export const MAX_CANVAS_ZOOM = 3;
const editable = "input,textarea,select,[contenteditable=true]";

/** Native scrolling bounds the camera; navigation never changes a lesson. */
export function useWorkspaceViewport(
  stageRef: RefObject<HTMLDivElement | null>,
  zoom: number,
  onZoom: (zoom: number) => void,
) {
  const [moving, setMoving] = useState(false);
  const space = useRef(false);
  const suppressClick = useRef(0);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const pending = useRef<{ left: number; top: number } | null>(null);
  const zoomTo = useCallback((value: number, anchor?: { x: number; y: number }) => {
    const node = stageRef.current;
    const next = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, value));
    if (!node || next === zoom) return;
    const padding = getComputedStyle(node);
    const x = (anchor?.x ?? node.clientWidth / 2) - (parseFloat(padding.paddingLeft) || 0),
      y = (anchor?.y ?? node.clientHeight / 2) - (parseFloat(padding.paddingTop) || 0);
    pending.current = {
      left: (node.scrollLeft + x) * next / zoom - x,
      top: (node.scrollTop + y) * next / zoom - y,
    };
    onZoom(next);
  }, [stageRef, zoom, onZoom]);
  useLayoutEffect(() => {
    const node = stageRef.current, position = pending.current;
    if (node && position) node.scrollTo(position);
    pending.current = null;
  }, [stageRef, zoom]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest(editable)) return;
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest("button,summary,a,[role=button]")) {
        space.current = true;
        if (stageRef.current?.contains(e.target as Node)) e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && stageRef.current?.contains(e.target as Node)) {
        if (["+", "=", "-", "0"].includes(e.key)) {
          e.preventDefault();
          zoomTo(e.key === "0" ? 1 : zoom * (e.key === "-" ? 1 / 1.2 : 1.2));
        }
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") space.current = false; };
    const blur = () => { space.current = false; drag.current = null; setMoving(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [stageRef, zoom, zoomTo]);
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const wheel = (e: WheelEvent) => {
      if ((!e.ctrlKey && !e.metaKey) || (e.target as Element).closest(editable)) return;
      e.preventDefault();
      e.stopPropagation();
      const box = node.getBoundingClientRect();
      const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? node.clientHeight : 1;
      zoomTo(zoom * Math.exp(Math.max(-1, Math.min(1, -e.deltaY * factor * .002))), {
        x: e.clientX - box.left - node.clientLeft,
        y: e.clientY - box.top - node.clientTop,
      });
    };
    // Capture before nested plots: this gesture always scales the whole canvas.
    node.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => node.removeEventListener("wheel", wheel, true);
  }, [stageRef, zoom, zoomTo]);
  const pinch = useRef<{ distance: number; zoom: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const geometry = (e: TouchEvent) => {
      const a = e.touches[0]!, b = e.touches[1]!, box = node.getBoundingClientRect(), css = getComputedStyle(node);
      return { distance: Math.hypot(b.clientX-a.clientX, b.clientY-a.clientY),
        x: (a.clientX+b.clientX)/2-box.left-node.clientLeft-(parseFloat(css.paddingLeft)||0),
        y: (a.clientY+b.clientY)/2-box.top-node.clientTop-(parseFloat(css.paddingTop)||0) };
    };
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2 || (e.target as Element).closest(`${editable},.pc-ink-active`)) return;
      e.preventDefault();
      const point = geometry(e);
      if (point.distance < 2) return;
      suppressClick.current = performance.now()+500;
      pinch.current = { distance: point.distance, zoom, x: (node.scrollLeft+point.x)/zoom, y: (node.scrollTop+point.y)/zoom };
    };
    const move = (e: TouchEvent) => {
      const initial = pinch.current;
      if (!initial || e.touches.length !== 2) return;
      e.preventDefault(); e.stopPropagation();
      const point = geometry(e), next = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, initial.zoom*point.distance/initial.distance));
      const position = { left: initial.x*next-point.x, top: initial.y*next-point.y };
      if (next === zoom) node.scrollTo(position);
      else { pending.current = position; onZoom(next); }
    };
    const end = () => { if(pinch.current)suppressClick.current=performance.now()+350; pinch.current = null; };
    node.addEventListener("touchstart", start, { passive: false, capture: true });
    node.addEventListener("touchmove", move, { passive: false, capture: true });
    node.addEventListener("touchend", end); node.addEventListener("touchcancel", end);
    return () => {
      node.removeEventListener("touchstart", start, true); node.removeEventListener("touchmove", move, true);
      node.removeEventListener("touchend", end); node.removeEventListener("touchcancel", end);
    };
  }, [stageRef, zoom, onZoom]);
  function finish(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    setMoving(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return {
    moving, zoomTo,
    reset: () => { pending.current = null; stageRef.current?.scrollTo({ left: 0, top: 0 }); },
    events: {
      onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => { if(e.detail>0&&performance.now()<suppressClick.current){e.preventDefault();e.stopPropagation();} },
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        if (![1, 2].includes(e.button) && !(space.current && e.button === 0) ||
          (e.target as Element).closest(`${editable},button,a,.pc-plot-overlay`)) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop };
        setMoving(true);
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (!d) return;
        e.stopPropagation();
        e.currentTarget.scrollTo({ left: d.left + d.x - e.clientX, top: d.top + d.y - e.clientY });
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
