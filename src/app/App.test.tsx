import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { App } from "./App";

function renderRoute(route = "/") {
  window.location.hash = `#${route}`;
  return render(
    <HashRouter>
      <App />
    </HashRouter>,
  );
}

describe("Fontex shell", () => {
  it.each([
    ["/", /tus fuentes/i],
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

  it("carga el tutor local y lo identifica como simulación", async () => {
    renderRoute("/tutor");

    expect(
      await screen.findByRole(
        "heading",
        { name: /consulta con contexto/i, level: 1 },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Simulación local")).toBeInTheDocument();
    expect(screen.getByText(/no se envía información a servicios externos/i)).toBeInTheDocument();
  });

  it("identifica claramente los datos demostrativos", () => {
    renderRoute();
    expect(screen.getByText(/datos ficticios/i)).toBeInTheDocument();
  });
});
