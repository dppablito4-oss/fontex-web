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
    fireEvent.change(screen.getByLabelText("Numerador"), { target: { value: "2" } });
    expect(screen.getByRole("img", { name: "2 de 4 partes por unidad" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Denominador"), { target: { value: "0" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "2 de 4 partes por unidad" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restablecer ejemplo" }));
    expect(screen.getByRole("img", { name: "3 de 4 partes por unidad" })).toBeInTheDocument();
    expect(lastMaterial(localStorage, "guest")).toEqual(saved);
  });
  it("ofrece accesos reales a las herramientas y al nivel elegido", () => {
    landing();
    expect(screen.getByRole("link", { name: "Crear en el lienzo" })).toHaveAttribute("href", "#/lienzo");
    expect(screen.getByRole("link", { name: "Explorar guías" })).toHaveAttribute("href", "#/demo");
    expect(screen.getByRole("link", { name: "Inicial · 3 a 5 años" })).toHaveAttribute("href", "#/demo?nivel=inicial");
    expect(screen.getByRole("link", { name: "Universidad introductoria" })).toHaveAttribute("href", "#/demo?nivel=universidad");
    expect(screen.getByRole("navigation", { name: "Áreas de Fontex" })).toBeInTheDocument();
  });
});
