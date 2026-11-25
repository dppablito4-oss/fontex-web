import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentAdmin } from "./AssessmentAdmin";
import { createAssessment, loadUniversityPretest } from "./service";

vi.mock("./service", async (importOriginal) => ({
  ...await importOriginal<typeof import("./service")>(),
  loadUniversityPretest: vi.fn(),
  listAssessments: vi.fn().mockResolvedValue({ forms: [], hasMore: false }),
  createAssessment: vi.fn().mockRejectedValue(new Error("Publicación de prueba")),
}));

describe("plantilla de pretest en Administración", () => {
  beforeEach(() => vi.clearAllMocks());

  it("carga 12 preguntas editables y publica solo al enviar el formulario", async () => {
    render(<AssessmentAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "Cargar pretest de Matemática" }));

    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Pretest de Matemática – Secundaria");
    expect(screen.getAllByRole("textbox", { name: /^Pregunta \d+$/ })).toHaveLength(12);
    expect(screen.getAllByRole("textbox", { name: "Opciones, una por línea" })).toHaveLength(8);
    expect(createAssessment).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "Pregunta 1" }), {
      target: { value: "¿Cuál es una fracción equivalente a 75 %?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar evaluación" }));

    await waitFor(() => expect(createAssessment).toHaveBeenCalledTimes(1));
    const sent = vi.mocked(createAssessment).mock.calls[0]?.[0];
    expect(sent?.kind).toBe("pretest");
    expect(sent?.questions).toHaveLength(12);
    expect(sent?.questions[0]).toEqual({
      kind: "choice",
      prompt: "¿Cuál es una fracción equivalente a 75 %?",
      options: ["1/4", "1/3", "3/4", "7/5"],
    });
    expect(sent?.questions.filter((question) => question.kind === "text")).toHaveLength(4);
    await screen.findByRole("alert");
  });

  it("carga las diez preguntas de Fontex y publica las claves seleccionadas", async () => {
    vi.mocked(loadUniversityPretest).mockResolvedValue({
      title: "Pretest universitario de Fontex", description: "", kind: "pretest",
      questions: Array.from({ length: 10 }, (_, index) => ({
        prompt: `Caso ${index + 1}`, kind: "choice", options: ["Uno", "Dos"], correct_option: "Uno",
      })),
    });
    render(<AssessmentAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "Cargar pretest universitario de Fontex" }));
    expect(await screen.findByText("Arquitectura y desarrollo · 60 %")).toBeInTheDocument();
    expect(screen.getByText("Uso de Fontex · 40 %")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: /^Pregunta \d+$/ })).toHaveLength(10);
    fireEvent.change(screen.getByRole("combobox", { name: "Respuesta correcta para la pregunta 1" }), {
      target: { value: "Dos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar evaluación" }));
    await waitFor(() => expect(createAssessment).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createAssessment).mock.calls[0]?.[0].questions[0]?.correct_option).toBe("Dos");
    await screen.findByRole("alert");
  });

  it("permite guardar selección múltiple sin pedir cantidad de códigos", async () => {
    render(<AssessmentAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "Nueva evaluación" }));
    expect(screen.queryByLabelText(/códigos individuales/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Título" }), { target: { value: "Encuesta" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Pregunta 1" }), { target: { value: "Elige colores" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de respuesta" }), { target: { value: "multiple" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Opciones, una por línea" }), {
      target: { value: "Verde\nNaranja" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar evaluación" }));
    await waitFor(() => expect(createAssessment).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createAssessment).mock.calls[0]?.[0].questions[0]).toEqual({
      kind: "multiple", prompt: "Elige colores", options: ["Verde", "Naranja"],
    });
    await screen.findByRole("alert");
  });

  it("mantiene la creación desde cero, incluida la opción Encuesta", () => {
    render(<AssessmentAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "Nueva evaluación" }));

    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("");
    expect(screen.getAllByRole("textbox", { name: /^Pregunta \d+$/ })).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "survey" } });
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveValue("survey");
    expect(createAssessment).not.toHaveBeenCalled();
  });
});
