import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DemoPage } from "./DemoPage";
import { ThemeProvider } from "../theme/ThemeProvider";
import { findCitation, readMaterials, tutorAvailable } from "./demoService";
import lessons from "../../../supabase/functions/_shared/practice/lessons.json";

vi.mock("./demoService", { spy: true });

beforeEach(() => {
  vi.mocked(readMaterials).mockResolvedValue({});
  vi.mocked(tutorAvailable).mockResolvedValue(null);
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
    for (const lesson of lessons) expect(findCitation(lesson.prompt, lesson), lesson.title).not.toBeNull();
  });

  it("muestra la teoría del error, permite corregirlo y conserva el resultado", async () => {
    const firstVisit = render(<ThemeProvider><DemoPage /></ThemeProvider>);
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
    fireEvent.click(screen.getByRole("button", { name: "Siguiente ejercicio" }));
    expect(screen.queryByRole("group", { name: /fracción es equivalente a 2\/3/i })).not.toBeInTheDocument();
    expect(screen.getByText("Ejercicio 2 de 3")).toBeVisible();
    firstVisit.unmount();

    render(<ThemeProvider><DemoPage /></ThemeProvider>);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Tu tutor de Matemática" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Práctica" }));
    expect(screen.getByText("1 de 3 resueltos")).toBeVisible();
    expect(screen.getByText("Correcto.")).toBeVisible();
  });

  it("elige temas y alterna las fuentes de consulta sin avisos técnicos", async () => {
    vi.mocked(tutorAvailable).mockResolvedValue("local");
    render(<ThemeProvider><DemoPage /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Secundaria" }));
    fireEvent.click(screen.getByRole("button", { name: /funciones afines.*ejercicios/i }));
    expect(screen.getByRole("heading", { name: "Pendiente de una recta" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Tutor" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Chat general" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Buscar en la web" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toBeEnabled());
    expect(screen.queryByText(/supabase|sin conectar/i)).not.toBeInTheDocument();
  });
});
