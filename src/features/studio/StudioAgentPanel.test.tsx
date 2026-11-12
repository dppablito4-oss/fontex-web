import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDocument, createObject } from "../../core/object-registry/registry";
import { StudioAgentPanel } from "./StudioAgentPanel";
import * as service from "./agentService";
afterEach(() => vi.restoreAllMocks());

it("prepara una propuesta local y requiere aplicar la vista previa", () => {
  const doc = createDocument();
  const apply = vi.fn(() => true);
  render(<StudioAgentPanel document={doc} selectedId={null} onApply={apply} />);
  fireEvent.click(screen.getByText("Fontex Agent"));
  fireEvent.click(screen.getByRole("button", { name: "Preparar ejemplo" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar acciones" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Aplicar acciones" }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ documentId: doc.id }), doc);
});

it("practica sin sesión con pistas graduadas y sin cambios automáticos", async () => {
  const doc = createDocument();
  const apply = vi.fn(() => true);
  render(<StudioAgentPanel document={doc} selectedId={doc.objects[0]!.id} onApply={apply} />);
  fireEvent.click(screen.getByText("Fontex Agent"));
  expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Modo"), { target: { value: "practice" } });
  fireEvent.click(screen.getByRole("button", { name: "Comprobar y orientar" }));
  expect(await screen.findByText(/Calcula 2\/3/)).not.toHaveTextContent("7/6");
  fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
  expect(await screen.findByText(/Primero busca divisiones/)).not.toHaveTextContent("7/6");
  fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
  expect(await screen.findByText(/Comprobación: 7\/6/)).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});

it.each(["learn", "solve"] as const)("consulta %s con nivel y revisa antes de aplicar", async mode => {
  const doc = createDocument();
  const object = createObject("text");
  const call = vi.spyOn(service, "requestAgent").mockResolvedValue({ message: "Una representación propuesta.", batch: { documentId: doc.id, actions: [{ kind: "create", object }] }, verification: [] });
  const apply = vi.fn(() => true);
  render(<StudioAgentPanel document={doc} selectedId={null} authenticated onApply={apply} />);
  fireEvent.click(screen.getByText("Fontex Agent"));
  fireEvent.change(screen.getByLabelText("Modo"), { target: { value: mode } });
  fireEvent.change(screen.getByLabelText("Nivel"), { target: { value: "introductory" } });
  fireEvent.change(screen.getByLabelText("Consulta"), { target: { value: "Crea un ejemplo" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
  expect(await screen.findByText("Una representación propuesta.")).toBeInTheDocument();
  expect(call).toHaveBeenCalledWith(expect.objectContaining({ mode, level: "introductory", question: "Crea un ejemplo" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Aplicar acciones" }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ documentId: doc.id }), doc);
});
