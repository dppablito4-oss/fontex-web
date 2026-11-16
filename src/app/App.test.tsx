import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { ThemeProvider } from "../features/theme/ThemeProvider";

function renderRoute(route = "/inicio") {
  window.location.hash = `#${route}`;
  return render(
    <ThemeProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </ThemeProvider>,
  );
}

describe("Fontex shell", () => {
  it("offers beta help and a report link without requiring an account", () => {
    renderRoute("/beta");
    expect(screen.getByRole("heading", { name: "Ayuda y datos durante la beta", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reportar un problema" })).toHaveAttribute("href", "mailto:pabloclsa87@gmail.com?subject=Incidencia%20beta%20Fontex");
  });
  it.each(["/", "/lienzo", "/lienzo-clasico", "/fracciones", "/demo"])("permite alternar y conservar el tema desde %s", async (route) => {
    const view = renderRoute(route);
    fireEvent.click(await screen.findByRole("button", { name: "Activar tema oscuro" }, { timeout: 5000 }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("fontex-theme")).toBe("dark");
    view.unmount();
    renderRoute(route);
    fireEvent.click(await screen.findByRole("button", { name: "Activar tema claro" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
  it("presenta Fontex en la raíz y conserva el lienzo libre y la IA lateral", async () => {
    const view = renderRoute("/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Entender cambia");
    view.unmount();
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1366 });
    renderRoute("/lienzo");
    expect(await screen.findByRole("tablist", { name: "Lienzos" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archivo" }));
    expect(screen.getByLabelText("Título del lienzo")).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Lienzo matemático" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Panel de Fontex" })).toBeVisible();
    expect(screen.getByText("Fontex Agente")).toBeInTheDocument();
    expect(window.location.hash).toBe("#/lienzo");
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: previousWidth });
  });
  it.each([
    ["/inicio", /tus fuentes/i],
    ["/aula", /tu aula/i],
    ["/grupo", /horizonte/i],
    ["/biblioteca", /biblioteca/i],
    ["/administracion", /administración/i],
  ])("renderiza la ruta %s", async (route, heading) => {
    renderRoute(route);
    expect(await screen.findByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
  });

  it("navega con HashRouter desde el menú móvil", async () => {
    renderRoute();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    fireEvent.click(screen.getByRole("link", { name: "Aula" }));

    await screen.findByRole("heading", { name: /tu aula/i, level: 1 });
    expect(window.location.hash).toBe("#/aula");
  });

  it("conserva el tema seleccionado al navegar entre páginas", async () => {
    renderRoute();
    fireEvent.click(screen.getByRole("button", { name: "Activar tema oscuro" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    fireEvent.click(screen.getByRole("link", { name: "Biblioteca" }));

    await screen.findByRole("heading", { name: "Biblioteca", level: 1 });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("fontex-theme")).toBe("dark");
  });

  it("salta al contenido sin modificar la ruta activa", () => {
    renderRoute("/aula");
    const activeHash = window.location.hash;

    fireEvent.click(screen.getByRole("link", { name: "Saltar al contenido" }));

    expect(screen.getByRole("main")).toHaveFocus();
    expect(window.location.hash).toBe(activeHash);
  });

  it("abre y cierra el menú móvil sin dejar controles accesibles al cerrarse", async () => {
    renderRoute();
    const menu = document.getElementById("navegacion-lateral");
    const openButton = screen.getByRole("button", { name: "Abrir menú" });

    expect(menu).toBeInTheDocument();
    expect(menu).toHaveAttribute("inert");
    expect(menu).toHaveAttribute("aria-hidden", "true");
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(openButton);
    expect(menu).not.toHaveAttribute("inert");
    expect(menu).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar menú" }));
    await waitFor(() => expect(openButton).toHaveFocus());
    expect(menu).toHaveAttribute("inert");
  });

  it("abre las opciones y las fuentes del tutor solo al pedirlas", async () => {
    renderRoute("/tutor");

    expect(
      await screen.findByRole(
        "heading",
        { name: /^tutor documental$/i, level: 1 },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Elige un aula para empezar")).toBeVisible();
    expect(screen.queryByRole("complementary", { name: "Fuentes" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fuentes" }));
    expect(screen.getByRole("complementary", { name: "Fuentes" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar panel" }));
    expect(screen.queryByRole("complementary", { name: "Fuentes" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Opciones de tutoría"));
    expect(screen.getByLabelText("Respuesta")).toBeInTheDocument();
    expect(screen.getByLabelText("Tutoría guiada")).toBeInTheDocument();
    expect(screen.queryByText("Shift+Enter")).not.toBeInTheDocument();
  });

  it("identifica claramente los datos demostrativos", () => {
    renderRoute();
    expect(screen.getByText(/datos ficticios/i)).toBeInTheDocument();
  });

  it("no inventa documentos ni contadores en la biblioteca sin Supabase", () => {
    renderRoute("/biblioteca");
    expect(screen.getByText(/biblioteca no disponible en modo demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/12 documentos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/metodología de la investigación/i)).not.toBeInTheDocument();
  });
});

// A generated fixed-height frame must never cover the next object with its content.
it("expands fixed-height content and moves the following object below it", async () => {
  const { newPrimitiveScene, createPrimitive } = await import(
    "../core/primitives/schema"
  );
  const scene = newPrimitiveScene();
  const first = createPrimitive("math_block", scene);
  first.label = "Texto manual";
  first.autoHeight = false;
  first.height = 100;
  first.y = 20;
  scene.primitives.push(first);
  const second = createPrimitive("math_block", scene);
  second.label = "Texto siguiente";
  second.autoHeight = false;
  second.height = 100;
  second.y = 160;
  scene.primitives.push(second);
  localStorage.setItem(
    "fontex-primitives-v2:guest",
    JSON.stringify({ activeId: scene.id, scenes: [scene] }),
  );
  const previous = globalThis.ResizeObserver,
    observers = new Map<Element, ResizeObserverCallback>();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(node: Element) {
        observers.set(node, this.callback);
      }
      unobserve() {}
      disconnect() {}
    },
  );
  try {
    renderRoute("/lienzo");
    const frame = await screen.findByRole("article", { name: "Texto manual" });
    const content = frame.querySelector<HTMLElement>(".pc-object-content")!;
    Object.defineProperty(content, "scrollHeight", {
      configurable: true,
      value: 450,
    });
    act(() => observers.get(content)!([], {} as ResizeObserver));
    await waitFor(() => expect(frame.style.height).toBe("474px"));
    expect(screen.getByRole("article", { name: "Texto siguiente" }).style.top)
      .toBe("534px");
  } finally {
    vi.stubGlobal("ResizeObserver", previous);
  }
});

it("edits a 100 cm measure, follows it on the plot, and restores automatic fitting after zoom undo", async () => {
  const { templateScene } = await import("../core/primitives/templates");
  const scene = templateScene("geometry");
  localStorage.setItem("fontex-primitives-v2:guest", JSON.stringify({ activeId: scene.id, scenes: [scene] }));
  renderRoute("/lienzo");
  fireEvent.click(await screen.findByText(/Definiciones y medidas/));
  const input = await screen.findByLabelText("Valor de b");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "100" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue("100");
  expect(screen.getByRole("slider", { name: "Variable b" })).toHaveAttribute("max", "100");
  expect(screen.getByText("Área 300 cm² · Perímetro 206 cm")).toBeInTheDocument();
  const plot = screen.getByRole("img", { name: "Compara las figuras" });
  const polygon = plot.querySelector("polygon")!;
  const width = () => {
    const xs = polygon.getAttribute("points")!.split(" ").map((pair) => Number(pair.split(",")[0]));
    return Math.max(...xs) - Math.min(...xs);
  };
  const originalWidth = width();
  fireEvent.click(screen.getByRole("button", { name: "Acercar plano" }));
  fireEvent.click(screen.getByRole("button", { name: "Acercar plano" }));
  expect(width()).toBeGreaterThan(originalWidth);
  expect(screen.getByText("Vista libre")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  expect(screen.getByText("Escala automática")).toBeInTheDocument();
  expect(width()).toBeCloseTo(originalWidth);
  expect(input).toHaveValue("100");
  fireEvent.click(screen.getByRole("button", { name: "Rehacer" }));
  expect(screen.getByText("Vista libre")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ajustar plano a las figuras" }));
  expect(screen.getByText("Escala automática")).toBeInTheDocument();
  // Figure measurements are edited directly over the same full-width plot.
  fireEvent.keyDown(screen.getByRole("button", { name: "Seleccionar figura Rectángulo" }), { key: "Enter" });
  const inspector = screen.getByRole("region", { name: "Edición sobre el plano" });
  expect(within(inspector).getByLabelText("Unidad")).toHaveValue("cm");
  expect(screen.getByRole("main", { name: "Lienzo matemático" })).toContainElement(inspector);
});
