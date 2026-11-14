import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CanvasDocumentTabs, CanvasToolMenu } from "./CanvasWorkspaceControls";

it("keeps document tabs stable when metadata is reordered and supports keyboard navigation", () => {
  const onOpen = vi.fn(), onNew = vi.fn();
  const a = { id: "a", title: "Áreas" }, b = { id: "b", title: "Fracciones" }, c = { id: "c", title: "Nuevo" };
  const view = render(<CanvasDocumentTabs scenes={[a, b]} activeId="a" onOpen={onOpen} onNew={onNew} />);
  view.rerender(<CanvasDocumentTabs scenes={[b, { ...a, title: "Áreas actualizadas" }, c]} activeId="a" onOpen={onOpen} onNew={onNew} />);
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Áreas actualizadas", "Fracciones", "Nuevo"]);
  const first = screen.getByRole("tab", { selected: true });
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(onOpen).toHaveBeenLastCalledWith("b");
  expect(screen.getByRole("tab", { name: "Fracciones" })).toHaveFocus();
  fireEvent.keyDown(first, { key: "End" });
  expect(onOpen).toHaveBeenLastCalledWith("c");
  fireEvent.click(screen.getByRole("button", { name: "Nuevo lienzo" }));
  expect(onNew).toHaveBeenCalledOnce();
});

it("closes tool options with Escape and restores focus to their trigger", () => {
  const onClose = vi.fn();
  render(<CanvasToolMenu label="Archivo" icon={null} open onToggle={vi.fn()} onClose={onClose}><input aria-label="Nombre" /></CanvasToolMenu>);
  expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Archivo" })).toHaveFocus();
});
