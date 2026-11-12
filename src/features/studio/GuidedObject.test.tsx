import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createDocument, createObject } from "../../core/object-registry/registry";
import { TeachingMode } from "./teaching-mode";
import { GuidedObject } from "./GuidedObject";
import { LessonPlayer } from "./LessonPlayer";
import { organizeObjects, readableBatch } from "./object-layout";
it("aprender recorre una idea y cambia el dibujo sin modificar el documento", () => {
  const object = createObject("operation"), snapshot = structuredClone(object);
  render(<GuidedObject object={object} />);
  expect(screen.getByRole("heading", { name: "Lee las cantidades" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Simplifica sin cambiar el valor" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
  expect(screen.getByRole("heading", { name: "Transforma la primera fracción" })).toBeInTheDocument();
  expect(screen.getByLabelText("Representación visual")).toHaveTextContent("4/6");
  expect(object).toEqual(snapshot);
});
it("practicar mantiene la respuesta reservada hasta la segunda pista", () => {
  render(<TeachingMode.Provider value="practice"><GuidedObject object={createObject("operation")} /></TeachingMode.Provider>);
  expect(screen.queryByText(/7\/6/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Respuesta del módulo"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Comprobar respuesta" }));
  expect(screen.getByRole("status")).toHaveTextContent("aún no coincide");
  fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
  expect(screen.getByRole("status")).not.toHaveTextContent("7/6");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar comprobación" }));
  expect(screen.getByRole("status")).toHaveTextContent("7/6");
});
it("resolver expone la solución y todas las justificaciones", () => {
  render(<TeachingMode.Provider value="solve"><GuidedObject object={createObject("operation")} /></TeachingMode.Provider>);
  expect(screen.getByRole("heading", { name: "Resultado: 7/6" })).toBeInTheDocument();
  expect(screen.getByLabelText("Pasos del módulo")).toHaveTextContent("Simplifica sin cambiar el valor");
  expect(screen.getByLabelText("Pasos del módulo")).toHaveTextContent("Comprueba");
});
it("recorre los módulos en orden vertical y reinicia el paso entre ellos", () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  const doc = createDocument("blank");
  doc.objects = [{ ...createObject("fraction"), y: 900 }, { ...createObject("operation"), y: 0 }];
  render(<LessonPlayer document={doc} onClose={vi.fn()} />);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("heading", { name: "Operación guiada" })).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Siguiente paso" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Siguiente módulo" }));
  expect(within(dialog).getByRole("heading", { name: "Reconoce la unidad" })).toBeInTheDocument();
});
it("organiza sin perder datos y coloca los módulos del agente debajo del material", () => {
  const doc = createDocument();
  const original = JSON.stringify(doc);
  const object = createObject("collection");
  const batch = readableBatch({ documentId: doc.id, actions: [{ kind: "create", object }] }, doc);
  expect(batch.actions[0]).toMatchObject({ object: { width: 1100, height: 720, data: object.data } });
  expect(organizeObjects(doc.objects)[0]).toMatchObject({ data: doc.objects[0]!.data, x: 60 });
  expect(JSON.stringify(doc)).toBe(original);
});
it("acepta un área decimal con coma en práctica sin depender de IA", () => {
  const object = createObject("geometry");
  if (object.type !== "geometry") throw new Error("Tipo inesperado");
  object.data = { figure: "triangle", base: 3, height: 5 };
  render(<TeachingMode.Provider value="practice"><GuidedObject object={object} /></TeachingMode.Provider>);
  fireEvent.change(screen.getByLabelText("Respuesta del módulo"), { target: { value: "7,5" } });
  fireEvent.click(screen.getByRole("button", { name: "Comprobar respuesta" }));
  expect(screen.getByRole("status")).toHaveTextContent("equivalente al resultado");
});
