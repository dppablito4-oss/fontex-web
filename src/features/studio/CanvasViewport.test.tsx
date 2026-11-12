import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { createObject } from "../../core/object-registry/registry";
import { CanvasViewport } from "./CanvasViewport";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
function canvas(type: "fraction" | "operation" = "fraction") {
  const object = { ...createObject(type), width: 240, height: 160 };
  const change = vi.fn();
  render(
    <CanvasViewport
      objects={[object]}
      selectedId={object.id}
      zoom={0.5}
      presenting={false}
      onSelect={vi.fn()}
      onChange={change}
      onDelete={vi.fn()}
    />,
  );
  return { object, change };
}
it("amplía un módulo sin cambiar las dimensiones del documento", () => {
  const { change } = canvas();
  fireEvent.click(screen.getByRole("button", { name: "Ampliar Fracción" }));
  const dialog = screen.getByRole("dialog", {
    name: "Vista ampliada: Fracción",
  });
  expect(within(dialog).getByRole("img", { name: "2 de 3 partes por unidad" }))
    .toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Cerrar vista ampliada" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("mantiene los pasos matemáticos interactivos en la vista ampliada", () => {
  const { change, object } = canvas("operation");
  fireEvent.doubleClick(
    screen.getByRole("button", { name: "Mover Operación guiada" }),
  );
  const dialog = screen.getByRole("dialog", {
    name: "Vista ampliada: Operación guiada",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Homogeneizar" }));
  expect(change).toHaveBeenCalledWith({
    ...object,
    data: { ...object.data, stage: 1 },
  });
});
it("previsualiza el tamaño según el zoom y confirma un único cambio al soltar", () => {
  const { change } = canvas();
  const handle = screen.getByRole("button", {
    name: "Cambiar tamaño de Fracción",
  });
  handle.setPointerCapture = vi.fn();
  fireEvent.pointerDown(handle, {
    button: 0,
    clientX: 100,
    clientY: 100,
    pointerId: 1,
  });
  fireEvent.pointerMove(handle, { clientX: 130, clientY: 120, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 150, clientY: 140, pointerId: 1 });
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("article", { name: "Fracción" })).toHaveStyle({
    width: "340px",
    height: "240px",
  });
  fireEvent.pointerUp(handle, { clientX: 150, clientY: 140, pointerId: 1 });
  expect(change).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({ width: 340, height: 240 }),
  );
});
it("cancela un cambio de tamaño sin guardarlo", () => {
  const { change } = canvas();
  const handle = screen.getByRole("button", {
    name: "Cambiar tamaño de Fracción",
  });
  handle.setPointerCapture = vi.fn();
  fireEvent.pointerDown(handle, {
    button: 0,
    clientX: 100,
    clientY: 100,
    pointerId: 1,
  });
  fireEvent.pointerMove(handle, { clientX: 160, clientY: 160, pointerId: 1 });
  fireEvent.pointerCancel(handle);
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("article", { name: "Fracción" })).toHaveStyle({
    width: "240px",
    height: "160px",
  });
});
