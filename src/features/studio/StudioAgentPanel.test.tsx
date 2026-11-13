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
  fireEvent.click(screen.getByText("Fontex Agente"));
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
  fireEvent.click(screen.getByText("Fontex Agente"));
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
    fireEvent.click(screen.getByText("Fontex Agente"));
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
      expect.objectContaining({ onText: expect.any(Function) as unknown, signal: expect.any(AbortSignal) as unknown }),
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
  expect(call).toHaveBeenLastCalledWith(expect.objectContaining({ history: [{ role: "user", content: "Qué es un hexágono" }, { role: "assistant", content: "Un hexágono tiene seis lados." }] }), expect.objectContaining({ onText: expect.any(Function) as unknown }));
  expect(screen.getByText("Qué es un hexágono")).toBeVisible();
  expect(apply).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Nueva conversación" }));
  expect(screen.queryByText("Aquí está el hexágono.")).not.toBeInTheDocument();
  expect(screen.queryByText("Qué es un hexágono")).not.toBeInTheDocument();
});

it("muestra la escritura real y ofrece crear desde la conversación con un clic", async () => {
  const doc = createDocument();
  let finish!: (value: Awaited<ReturnType<typeof service.requestAgent>>) => void;
  const call = vi.spyOn(service, "requestAgent").mockImplementationOnce((_request, options) => {
    options?.onText("Podemos representar un hexágono");
    return new Promise(resolve => { finish = resolve; });
  }).mockResolvedValueOnce({ message: "Creado.", batch: { documentId: doc.id, actions: [] }, verification: [] });
  render(<StudioAgentPanel document={doc} selectedId={null} authenticated onApply={() => true} />);
  fireEvent.change(screen.getByLabelText("Consulta"), { target: { value: "Muéstrame cómo se hace" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
  expect(await screen.findByText("Podemos representar un hexágono")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Escribiendo");
  finish({ message: "Un hexágono tiene seis lados.", batch: { documentId: doc.id, actions: [] }, verification: [] });
  fireEvent.click(await screen.findByRole("button", { name: "Crear en el lienzo" }));
  await screen.findByText("Creado.");
  expect(call).toHaveBeenLastCalledWith(expect.objectContaining({ task: "build", history: expect.arrayContaining([{ role: "assistant", content: "Un hexágono tiene seis lados." }]) as unknown }), expect.any(Object));
  expect(screen.queryByText(/Luna|Sol|GPT-/)).not.toBeInTheDocument();
});

it("descarta un lote generado si cambió el nivel mientras respondía", async () => {
  const doc = createDocument(), apply = vi.fn(() => true);
  let finish!: (value: Awaited<ReturnType<typeof service.requestAgent>>) => void;
  vi.spyOn(service, "requestAgent").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<StudioAgentPanel document={doc} selectedId={null} teachingLevel="primary" authenticated onApply={apply} />);
  fireEvent.change(screen.getByLabelText("Consulta"), { target: { value: "Crea un círculo" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
  view.rerender(<StudioAgentPanel document={doc} selectedId={null} teachingLevel="secondary" authenticated onApply={apply} />);
  finish({ message: "Creado.", batch: { documentId: doc.id, actions: [{ kind: "create", object: createObject("circle") }] }, verification: [] });
  expect(await screen.findByRole("alert")).toHaveTextContent("Cambió el nivel");
  expect(apply).not.toHaveBeenCalled();
  expect(screen.queryByText("Creado.")).not.toBeInTheDocument();
});
