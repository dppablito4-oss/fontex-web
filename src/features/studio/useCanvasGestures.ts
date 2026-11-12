import { useEffect, useRef, type RefObject } from "react";
export const limitZoom = (value: number) => Math.max(0.2, Math.min(2.5, value));
export function useCanvasGestures(viewport: RefObject<HTMLDivElement | null>, zoom: number, onZoom?: (value: number) => void) {
  const pinch = useRef<{ distance: number; zoom: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element || !onZoom) return;
    function change(next: number, clientX: number, clientY: number) {
      if (!element || !onZoom) return;
      next = limitZoom(next);
      const bounds = element.getBoundingClientRect();
      const x = clientX - bounds.left, y = clientY - bounds.top;
      const left = (element.scrollLeft + x) / zoom, top = (element.scrollTop + y) / zoom;
      onZoom(next);
      requestAnimationFrame(() => { element.scrollLeft = left * next - x; element.scrollTop = top * next - y; });
    }
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      change(zoom * Math.exp(-event.deltaY * 0.005), event.clientX, event.clientY);
    }
    function start(event: TouchEvent) {
      if (event.touches.length !== 2) return;
      const [a, b] = [event.touches[0]!, event.touches[1]!];
      pinch.current = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom, x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      event.preventDefault();
    }
    function move(event: TouchEvent) {
      if (event.touches.length !== 2 || !pinch.current) return;
      event.preventDefault();
      const [a, b] = [event.touches[0]!, event.touches[1]!];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch.current.distance > 0) change(pinch.current.zoom * distance / pinch.current.distance, pinch.current.x, pinch.current.y);
    }
    function end() { pinch.current = null; }
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("touchstart", start, { passive: false });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", end);
    return () => { element.removeEventListener("wheel", wheel); element.removeEventListener("touchstart", start); element.removeEventListener("touchmove", move); element.removeEventListener("touchend", end); element.removeEventListener("touchcancel", end); };
  }, [viewport, zoom, onZoom]);
}
