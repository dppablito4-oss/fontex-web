import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CanvasViewport } from "./CanvasViewport";
import { limitZoom } from "./useCanvasGestures";
it("aplica Ctrl+rueda dentro del lienzo y conserva el scroll ordinario", () => {
  const zoom = vi.fn();
  const { container } = render(<CanvasViewport objects={[]} selectedId={null} zoom={1} onZoom={zoom} presenting={false} onSelect={vi.fn()} onChange={vi.fn()} onDelete={vi.fn()} />);
  const viewport = container.querySelector('.st-viewport')!;
  fireEvent.wheel(viewport, { deltaY: -100 });
  expect(zoom).not.toHaveBeenCalled();
  fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true, clientX: 50, clientY: 50 });
  expect(zoom).toHaveBeenLastCalledWith(expect.closeTo(Math.exp(0.5)));
  expect(screen.getByText('Nuevo material')).toBeInTheDocument();
});
it("pellizca solo el lienzo y mantiene límites de zoom", () => {
  const zoom = vi.fn();
  const { container } = render(<CanvasViewport objects={[]} selectedId={null} zoom={1} onZoom={zoom} presenting={false} onSelect={vi.fn()} onChange={vi.fn()} onDelete={vi.fn()} />);
  const viewport = container.querySelector('.st-viewport')!;
  fireEvent.touchStart(viewport, { touches: [{clientX:0,clientY:0}, {clientX:100,clientY:0}] });
  fireEvent.touchMove(viewport, { touches: [{clientX:0,clientY:0}, {clientX:200,clientY:0}] });
  expect(zoom).toHaveBeenLastCalledWith(2);
  expect(limitZoom(100)).toBe(2.5);
  expect(limitZoom(0)).toBe(.2);
});
