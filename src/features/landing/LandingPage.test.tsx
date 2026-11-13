import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "../theme/ThemeProvider";
import { LandingPage } from "./LandingPage";
import { createDocument } from "../../core/object-registry/registry";
import { lastMaterial, saveMaterial } from "../studio/document-store";

function landing() { return render(<ThemeProvider><LandingPage /></ThemeProvider>); }
describe("Presentación de Fontex", () => {
  it("permite experimentar sin modificar los materiales guardados", () => {
    const saved = createDocument(); saveMaterial(localStorage, "guest", saved);
    landing();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Entender cambia");
    expect(screen.getByRole("img", { name: /Parábola y = 0.5 x/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Apertura de la parábola" }), { target: { value: "1" } });
    expect(screen.getByRole("img", { name: /Parábola y = 1 x/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pausar animación" }));
    expect(screen.getByRole("button", { name: "Reanudar animación" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restablecer ejemplo" }));
    expect(screen.getByRole("img", { name: /Parábola y = 0.5 x/ })).toBeInTheDocument();
    expect(lastMaterial(localStorage, "guest")).toEqual(saved);
  });
  it("ofrece accesos reales a las herramientas y al nivel elegido", () => {
    landing();
    expect(screen.getByRole("link", { name: "Crear en el lienzo" })).toHaveAttribute("href", "#/lienzo");
    expect(screen.getByRole("link", { name: "Explorar guías" })).toHaveAttribute("href", "#/demo");
    expect(screen.getByRole("link", { name: "Inicial · 3 a 5 años" })).toHaveAttribute("href", "#/demo?nivel=inicial");
    expect(screen.getByRole("link", { name: "Universidad introductoria" })).toHaveAttribute("href", "#/demo?nivel=universidad");
    expect(screen.getByRole("navigation", { name: "Áreas de Fontex" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "space.sypablitodp.site" })).toHaveAttribute("href", "https://space.sypablitodp.site");
    expect(screen.getByRole("link", { name: "WhatsApp: 918 165 428" })).toHaveAttribute("href", "https://wa.me/51918165428");
  });
});
