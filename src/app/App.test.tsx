import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

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
    expect(await screen.findByLabelText("Título del material")).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Editor del material" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Asistente del material" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Fontex Agente" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#/lienzo");
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: previousWidth });
  });
  it.each([
    ["/inicio", /tus fuentes/i],
    ["/aula", /tu aula/i],
    ["/grupo", /horizonte/i],
    ["/biblioteca", /biblioteca/i],
    ["/administracion", /administración/i],
  ])("renderiza la ruta %s", (route, heading) => {
    renderRoute(route);
    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
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
