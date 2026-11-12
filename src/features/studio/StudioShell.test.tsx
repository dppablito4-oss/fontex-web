import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StudioShell } from "./StudioShell";
import { ThemeProvider } from "../theme/ThemeProvider";
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
  it("mantiene el catálogo cerrado y permite desplegarlo sin cambiar el lienzo", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    const toggle = screen.getByRole("button", { name: "Módulos" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Añadir fracción" })).not.toBeInTheDocument();
    expect(screen.queryByText("Acciones locales")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Añadir fracción" })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByRole("button", { name: "Añadir fracción" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover Operación guiada" })).toBeInTheDocument();
  });
  it("busca los nuevos módulos sin afectar el material del lienzo", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Módulos" }));
    fireEvent.change(screen.getByLabelText("Buscar objeto"), { target: { value: "circulo" } });
    expect(screen.getByRole("button", { name: "Añadir círculos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Añadir fracción" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover Operación guiada" })).toBeInTheDocument();
  });
  it("abre al 100 % en escritorio y permite restablecer el zoom", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    expect(screen.getByLabelText("Nivel de zoom")).toHaveTextContent("100%");
    fireEvent.click(screen.getByRole("button", { name: "Alejar" }));
    expect(screen.getByLabelText("Nivel de zoom")).toHaveTextContent("90%");
    fireEvent.click(screen.getByRole("button", { name: "Ver al 100 %" }));
    expect(screen.getByLabelText("Nivel de zoom")).toHaveTextContent("100%");
  });
  it("guarda un cambio de tamaño con teclado y permite deshacerlo", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Módulos" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir fracción" }));
    const article = screen.getByRole("article", { name: "Fracción" });
    expect(article).toHaveStyle({ width: "440px", height: "340px" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Cambiar tamaño de Fracción" }), { key: "ArrowDown", shiftKey: true });
    expect(article).toHaveStyle({ height: "440px" });
    expect(lastMaterial(localStorage, "guest")?.objects.find(object => object.type === "fraction")?.height).toBe(440);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(article).toHaveStyle({ height: "340px" });
  });
  it("edita colecciones, conserva multiplicidades y recupera las estadísticas", () => {
    const view = render(<ThemeProvider><StudioShell /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Módulos" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir colección numérica" }));
    fireEvent.change(inspector().getByLabelText("Enteros de la colección"), { target: { value: "1, 2, 2" } });
    fireEvent.click(inspector().getByRole("button", { name: "Aplicar cambios" }));
    const article = within(screen.getByRole("article", { name: "Colección numérica" }));
    expect(article.getByText("Suma").nextElementSibling).toHaveTextContent("5");
    expect(article.getByText("Media exacta").nextElementSibling).toHaveTextContent("5/3");
    view.unmount();
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    expect(within(screen.getByRole("list", { name: "Números de la colección" })).getAllByRole("listitem")).toHaveLength(3);
  });
  it("edita rectas y rechaza pasos incompatibles sin perder el material", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Módulos" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir recta numérica" }));
    for (const [name, value] of [["Mínimo de la recta", "-4"], ["Máximo de la recta", "4"], ["Tamaño del paso", "2"], ["Puntos enteros", "-2, 2"]]) fireEvent.change(inspector().getByLabelText(name!), { target: { value } });
    fireEvent.click(inspector().getByRole("button", { name: "Aplicar cambios" }));
    expect(screen.getByRole("img", { name: /Recta de -4 a 4, paso 2/ })).toBeInTheDocument();
    fireEvent.change(inspector().getByLabelText("Tamaño del paso"), { target: { value: "3" } });
    fireEvent.click(inspector().getByRole("button", { name: "Aplicar cambios" }));
    expect(inspector().getByRole("alert")).toHaveTextContent("Revisa los valores");
    expect(screen.getByRole("img", { name: /Recta de -4 a 4, paso 2/ })).toBeInTheDocument();
  });
  it("resuelve una ecuación racional por etapas y conserva el resultado al reabrir", () => {
    const view = render(<ThemeProvider><StudioShell /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Módulos" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir ecuación lineal" }));
    fireEvent.change(inspector().getByLabelText("Coeficiente d"), { target: { value: "4" } });
    fireEvent.click(inspector().getByRole("button", { name: "Aplicar cambios" }));
    fireEvent.change(inspector().getByLabelText("Etapa de la ecuación"), { target: { value: "2" } });
    fireEvent.click(inspector().getByRole("button", { name: "Aplicar cambios" }));
    expect(screen.getByText("x = 1/2")).toBeInTheDocument();
    view.unmount();
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    expect(screen.getByText("x = 1/2")).toBeInTheDocument();
  });
  it("crea, edita, duplica y elimina; deshacer recupera el objeto con sus valores", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Módulos" }));
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
    const view = render(<ThemeProvider><StudioShell /></ThemeProvider>);
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
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    expect(screen.getByText("La cantidad se conserva.")).toBeInTheDocument();
    expect(
      lastMaterial(localStorage, "guest")?.objects.find(
        (object) => object.type === "text",
      )?.y,
    ).toBe(80);
  });
  it("explica la homogeneización y el resultado sin llamadas de IA", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
    expect(screen.getByRole("heading", { name: "Busca piezas del mismo tamaño" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
    expect(screen.getByRole("heading", { name: "Transforma la primera fracción" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
    expect(screen.getByText("Resultado simplificado: 7/6")).toBeInTheDocument();
  });
  it("usa el mismo editor para crear, modificar y recuperar sucesiones", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir materiales" }),
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
  });
  it("rechaza operaciones inválidas sin perder el documento", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
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
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Presentar" }));
    expect(
      screen.getByRole("button", { name: /Salir de presentación/ }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("button", { name: /Salir de presentación/ }),
    ).not.toBeInTheDocument();
  });
  it.each(["v1", "v2"])("no destruye materiales %s cuando falla la recuperación", (version) => {
    const document = createDocument();
    const storageKey = version === "v1" ? `fontex-studio-v1:guest:document:${document.id}` : "fontex-studio-v2:guest";
    if (version === "v1") {
      localStorage.setItem("fontex-studio-v1:guest:index", JSON.stringify([document]));
      localStorage.setItem("fontex-studio-v1:guest:active", document.id);
    } else saveMaterial(localStorage, "guest", document);
    localStorage.setItem(storageKey, "{");
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo recuperar");
    expect(
      localStorage.getItem(storageKey),
    ).toBe("{");
  });
  it("advierte si el guardado falla y mantiene el material editable", () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    fireEvent.click(screen.getByRole("button", { name: "Módulos" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir texto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(inspector().getByLabelText("Contenido")).toBeInTheDocument();
    spy.mockRestore();
  });
  it("importa como copia y rechaza un JSON inválido sin sustituir el material", async () => {
    render(<ThemeProvider><StudioShell /></ThemeProvider>);
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
