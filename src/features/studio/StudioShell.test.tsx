import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StudioShell } from "./StudioShell";
import { lastMaterial, saveMaterial } from "./document-store";
import { createDocument } from "../../core/object-registry/registry";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
const inspector = () =>
  within(screen.getByRole("complementary", { name: "Propiedades del objeto" }));
afterEach(() => vi.restoreAllMocks());

describe("Fontex Studio", () => {
  it("crea, edita, duplica y elimina; deshacer recupera el objeto con sus valores", () => {
    render(<StudioShell />);
    fireEvent.click(screen.getByRole("button", { name: "Añadir fracción" }));
    fireEvent.change(inspector().getByLabelText("Numerador"), {
      target: { value: "3" },
    });
    fireEvent.change(inspector().getByLabelText("Denominador"), {
      target: { value: "4" },
    });
    fireEvent.click(
      inspector().getByRole("button", { name: "Aplicar cambios" }),
    );
    expect(
      screen.getByRole("img", { name: "3 de 4 partes por unidad" }),
    ).toBeInTheDocument();
    fireEvent.click(inspector().getByRole("button", { name: "Duplicar" }));
    expect(
      screen.getAllByRole("img", { name: "3 de 4 partes por unidad" }),
    ).toHaveLength(2);
    fireEvent.click(inspector().getByRole("button", { name: "Eliminar" }));
    expect(
      screen.getAllByRole("img", { name: "3 de 4 partes por unidad" }),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(
      screen.getAllByRole("img", { name: "3 de 4 partes por unidad" }),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Rehacer" }));
    expect(
      screen.getAllByRole("img", { name: "3 de 4 partes por unidad" }),
    ).toHaveLength(1);
    expect(
      lastMaterial(localStorage, "guest")?.objects.filter(
        (object) => object.type === "fraction",
      ),
    ).toHaveLength(1);
  });
  it("recupera textos y posiciones al volver a abrir el editor", () => {
    const view = render(<StudioShell />);
    fireEvent.click(screen.getByRole("button", { name: "Mover Texto" }));
    fireEvent.change(inspector().getByLabelText("Contenido"), {
      target: { value: "La cantidad se conserva." },
    });
    fireEvent.click(
      inspector().getByRole("button", { name: "Aplicar cambios" }),
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Mover Texto" }), {
      key: "ArrowDown",
    });
    view.unmount();
    render(<StudioShell />);
    expect(screen.getByText("La cantidad se conserva.")).toBeInTheDocument();
    expect(
      lastMaterial(localStorage, "guest")?.objects.find(
        (object) => object.type === "text",
      )?.y,
    ).toBe(80);
  });
  it("explica la homogeneización y el resultado sin llamadas de IA", () => {
    render(<StudioShell />);
    fireEvent.click(screen.getByRole("button", { name: "Homogeneizar" }));
    expect(screen.getByText(/El m.c.m. de 3 y 6 es 6/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver resultado" }));
    expect(screen.getByText("Resultado simplificado: 7/6")).toBeInTheDocument();
  });
  it("usa el mismo editor para crear, modificar y recuperar sucesiones", () => {
    render(<StudioShell />);
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir / crear material" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "⋯ Sucesiones",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mover Sucesión" }));
    fireEvent.change(inspector().getByLabelText("Diferencia entre términos"), {
      target: { value: "3" },
    });
    fireEvent.click(
      inspector().getByRole("button", { name: "Aplicar cambios" }),
    );
    expect(screen.getByRole("img", { name: "14 puntos" })).toBeInTheDocument();
    expect(lastMaterial(localStorage, "guest")?.objects[0]?.data).toMatchObject(
      { start: 2, difference: 3, count: 5 },
    );
    expect(screen.getByText("Guardado en este navegador")).toBeInTheDocument();
  });
  it("rechaza operaciones inválidas sin perder el documento", () => {
    render(<StudioShell />);
    fireEvent.click(
      screen.getByRole("button", { name: "Mover Operación guiada" }),
    );
    fireEvent.change(inspector().getByLabelText("Operación", { exact: true }), {
      target: { value: "1/0 + 1/2" },
    });
    fireEvent.click(
      inspector().getByRole("button", { name: "Aplicar cambios" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "denominador no puede ser cero",
    );
    expect(screen.getByText("2/3 + 3/6")).toBeInTheDocument();
  });
  it("mantiene una salida de presentación cuando fullscreen no está disponible", () => {
    render(<StudioShell />);
    fireEvent.click(screen.getByRole("button", { name: "Presentar" }));
    expect(
      screen.getByRole("button", { name: /Salir de presentación/ }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("button", { name: /Salir de presentación/ }),
    ).not.toBeInTheDocument();
  });
  it("no destruye materiales guardados cuando falla la recuperación", () => {
    const document = createDocument();
    saveMaterial(localStorage, "guest", document);
    localStorage.setItem(`fontex-studio-v1:guest:document:${document.id}`, "{");
    render(<StudioShell />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo recuperar");
    expect(
      localStorage.getItem(`fontex-studio-v1:guest:document:${document.id}`),
    ).toBe("{");
  });
  it("advierte si el guardado falla y mantiene el material editable", () => {
    render(<StudioShell />);
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    fireEvent.click(screen.getByRole("button", { name: "Añadir texto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(inspector().getByLabelText("Contenido")).toBeInTheDocument();
    spy.mockRestore();
  });
  it("importa como copia y rechaza un JSON inválido sin sustituir el material", async () => {
    render(<StudioShell />);
    const input = screen.getByLabelText("Importar material JSON");
    const document = createDocument("sequences");
    const valid = new File([], "material.json", { type: "application/json" });
    Object.defineProperty(valid, "text", {
      value: () => Promise.resolve(JSON.stringify(document)),
    });
    fireEvent.change(input, { target: { files: [valid] } });
    await screen.findByDisplayValue("Sucesiones: descubre el patrón");
    expect(lastMaterial(localStorage, "guest")?.id).not.toBe(document.id);
    const before = lastMaterial(localStorage, "guest");
    const invalid = new File([], "invalido.json", { type: "application/json" });
    Object.defineProperty(invalid, "text", {
      value: () => Promise.resolve('{"schemaVersion":900}'),
    });
    fireEvent.change(input, { target: { files: [invalid] } });
    await screen.findByText(/no es un documento válido/);
    expect(lastMaterial(localStorage, "guest")).toEqual(before);
  });
});
