import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  createDocument,
  createObject,
} from "../../core/object-registry/registry";
import { StudioAgentPanel } from "./StudioAgentPanel";
import * as service from "./agentService";
afterEach(() => vi.restoreAllMocks());

it("reinicia las pistas visibles al cambiar de objeto sin perder el modo", async () => {
  const doc = createDocument();
  const sequence = createObject("sequence");
  doc.objects.push(sequence);
  const apply = vi.fn(() => true);
  const view = render(
    <StudioAgentPanel
      document={doc}
      selectedId={doc.objects[0]!.id}
      onApply={apply}
    />,
  );
  fireEvent.click(screen.getByText("Fontex Agent"));
  fireEvent.change(screen.getByLabelText("Modo"), {
    target: { value: "practice" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Comprobar y orientar" }));
  await screen.findByText(/Calcula 2\/3/);
  fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
  await screen.findByText(/Primero busca divisiones/);
  fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
  await screen.findByText(/Comprobación: 7\/6/);
  view.rerender(
    <StudioAgentPanel
      document={doc}
      selectedId={sequence.id}
      onApply={apply}
    />,
  );
  expect(screen.getByLabelText("Modo")).toHaveValue("practice");
  expect(screen.queryByText(/Comprobación: 7\/6/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Otra pista" })).not
    .toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Comprobar y orientar" }));
  expect(await screen.findByText(/Qué término sigue/)).not.toHaveTextContent(
    "Comprobación: 12",
  );
});

it("permite revisar cambios de la IA antes de aplicarlos sin mostrar datos técnicos", async () => {
  const doc = createDocument();
  const object = createObject("fraction");
  vi.spyOn(service, "requestAgent").mockResolvedValue({
    message: "Una fracción para tu material.",
    batch: { documentId: doc.id, actions: [{ kind: "create", object }] },
    verification: [],
  });
  const apply = vi.fn(() => true);
  render(<StudioAgentPanel document={doc} selectedId={null} authenticated onApply={apply} />);
  expect(screen.queryByText("Acciones locales")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Aplicar cambios automáticamente" }));
  fireEvent.change(screen.getByLabelText("Consulta"), { target: { value: "Crea una fracción" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
  await screen.findByText("Una fracción para tu material.");
  expect(apply).not.toHaveBeenCalled();
  expect(screen.queryByText("Valores propuestos")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Aplicar acciones" }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ documentId: doc.id }), doc);
});

it("practica sin sesión con pistas graduadas y sin cambios automáticos", async () => {
  const doc = createDocument();
  const apply = vi.fn(() => true);
  render(
    <StudioAgentPanel
      document={doc}
      selectedId={doc.objects[0]!.id}
      onApply={apply}
    />,
  );
  fireEvent.click(screen.getByText("Fontex Agent"));
  expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Modo"), {
    target: { value: "practice" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Comprobar y orientar" }));
  expect(await screen.findByText(/Calcula 2\/3/)).not.toHaveTextContent("7/6");
  fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
  expect(await screen.findByText(/Primero busca divisiones/)).not
    .toHaveTextContent("7/6");
  fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
  expect(await screen.findByText(/Comprobación: 7\/6/)).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});

it.each(["learn", "solve"] as const)(
  "consulta %s con nivel y aplica automáticamente",
  async (mode) => {
    const doc = createDocument();
    const object = createObject("text");
    const call = vi.spyOn(service, "requestAgent").mockResolvedValue({
      message: "Una representación propuesta.",
      batch: { documentId: doc.id, actions: [{ kind: "create", object }] },
      verification: [],
    });
    const apply = vi.fn(() => true);
    render(
      <StudioAgentPanel
        document={doc}
        selectedId={null}
        authenticated
        onApply={apply}
      />,
    );
    fireEvent.click(screen.getByText("Fontex Agent"));
    fireEvent.change(screen.getByLabelText("Modo"), {
      target: { value: mode },
    });
    fireEvent.change(screen.getByLabelText("Nivel"), {
      target: { value: "introductory" },
    });
    fireEvent.change(screen.getByLabelText("Consulta"), {
      target: { value: "Crea un ejemplo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
    expect(await screen.findByText("Una representación propuesta."))
      .toBeInTheDocument();
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({
        mode,
        level: "introductory",
        question: "Crea un ejemplo",
      }),
    );
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Cambios aplicados");
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: doc.id }),
      doc,
    );
  },
);
it("convierte el módulo seleccionado a práctica sin IA ni cambios de datos", () => {
  const doc=createDocument(),mode=vi.fn(),apply=vi.fn();
  render(<StudioAgentPanel document={doc} selectedId={doc.objects[0]!.id} onApply={apply} onModeChange={mode}/>);
  fireEvent.click(screen.getByRole("button",{name:"Practicar esto"}));
  expect(mode).toHaveBeenCalledWith("practice");expect(apply).not.toHaveBeenCalled();
});

it("conserva conversación y contexto al pasar de explicar a crear, y permite empezar otra", async () => {
  const doc = createDocument();
  const call = vi.spyOn(service, "requestAgent")
    .mockResolvedValueOnce({ message: "Un hexágono tiene seis lados.", batch: { documentId: doc.id, actions: [] }, verification: [] })
    .mockResolvedValueOnce({ message: "Aquí está el hexágono.", batch: { documentId: doc.id, actions: [{ kind: "create", object: createObject("regular-polygon") }] }, verification: [] });
  const apply = vi.fn(() => true);
  render(<StudioAgentPanel document={doc} selectedId={null} authenticated onApply={apply} />);
  fireEvent.change(screen.getByLabelText("Consulta"), { target: { value: "Qué es un hexágono" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
  await screen.findByText("Un hexágono tiene seis lados.");
  expect(apply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Consulta"), { target: { value: "Sí, créalo" } });
  expect(screen.getByText("Un hexágono tiene seis lados.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
  await screen.findByText("Aquí está el hexágono.");
  expect(call).toHaveBeenLastCalledWith(expect.objectContaining({ history: [{ role: "user", content: "Qué es un hexágono" }, { role: "assistant", content: "Un hexágono tiene seis lados." }] }));
  expect(screen.getByText("Qué es un hexágono")).toBeVisible();
  expect(apply).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Nueva conversación" }));
  expect(screen.queryByText("Aquí está el hexágono.")).not.toBeInTheDocument();
  expect(screen.queryByText("Qué es un hexágono")).not.toBeInTheDocument();
});
