import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DemoPage } from "./DemoPage";
import { findCitation, readMaterials, tutorAvailable } from "./demoService";
import lessons from "./lessons.json";

vi.mock("./demoService", { spy: true });

beforeEach(() => {
  vi.mocked(readMaterials).mockResolvedValue({});
  vi.mocked(tutorAvailable).mockResolvedValue(false);
  localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

describe("Tutor personal de Matemática", () => {
  it("recupera la página de la guía y se abstiene fuera del tema", () => {
    const fraction = lessons.find(({ id }) => id === "fracciones")!;
    const functions = lessons.find(({ id }) => id === "funciones")!;
    expect(findCitation(fraction.prompt, fraction)).toMatchObject({ page: 2, sourceId: "fracciones" });
    const mathCitation = findCitation(functions.prompt, functions);
    expect(mathCitation).toMatchObject({ page: 1, sourceId: "funciones" });
    expect(mathCitation?.excerpt).toContain("y₂");
    expect(findCitation("¿Quién ganó el mundial de fútbol?", fraction)).toBeNull();
  });

  it("muestra la teoría del error, permite corregirlo y conserva el resultado", async () => {
    const firstVisit = render(<DemoPage />);
    fireEvent.click(screen.getByRole("button", { name: /fracciones equivalentes.*ejercicios/i }));
    expect(screen.getByRole("heading", { name: "Teoría y ejemplos" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Pasar a los ejercicios" }));

    const exercise = screen.getByRole("group", { name: /fracción es equivalente a 2\/3/i });
    fireEvent.click(within(exercise).getByRole("radio", { name: "2/6" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Comprobar" })[0]!);
    expect(screen.getByText(/duplicaste solo el denominador/i)).toBeVisible();
    const panel = screen.getByRole("complementary", { name: "Teoría del ejercicio" });
    expect(within(panel).getByRole("heading", { name: "Amplificar y simplificar" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Volver a intentarlo" }));
    fireEvent.click(within(exercise).getByRole("radio", { name: "4/6" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Comprobar" })[0]!);
    expect(screen.getByText("Correcto.")).toBeVisible();
    firstVisit.unmount();

    render(<DemoPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Tu tutor de Matemática" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Práctica" }));
    expect(screen.getByText("1 de 3 resueltos")).toBeVisible();
    expect(screen.getByText("Correcto.")).toBeVisible();
  });

  it("elige los temas por nivel y muestra el modelo del modo de tutoría", () => {
    render(<DemoPage />);
    fireEvent.click(screen.getByRole("button", { name: "Secundaria" }));
    fireEvent.click(screen.getByRole("button", { name: /funciones afines.*ejercicios/i }));
    expect(screen.getByRole("heading", { name: "Pendiente de una recta" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Tutor" }));
    expect(screen.getByText(/GPT-6\.1 Sol · sin conectar/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Chat general" }));
    expect(screen.getByText(/GPT-6 Luna · sin conectar/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sitios confiables" }));
    expect(screen.getByText(/GPT-6\.1 Sol · sin conectar/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Khan Academy/ })).toBeVisible();
  });
});
