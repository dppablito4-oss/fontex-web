import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentAdmin } from "./AssessmentAdmin";
import { createAssessment } from "./service";

vi.mock("./service", async (importOriginal) => ({
  ...await importOriginal<typeof import("./service")>(),
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
