import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentAssessmentPage } from "./StudentAssessmentPage";
import { type BrowserAssessment, loadBrowserAssessment } from "./service";

vi.mock("./service", async (importOriginal) => ({
  ...await importOriginal<typeof import("./service")>(),
  loadBrowserAssessment: vi.fn(),
}));

const token = "00000000-0000-4000-8000-000000000001";
const startKey = `fontex-assessment-start-v1:${token}`;
const form: BrowserAssessment = {
  state: "open", title: "Pretest universitario de Fontex", kind: "pretest", description: "", question_version: 1, graded: true,
  questions: Array.from({ length: 10 }, (_, index) => ({
    position: index + 1, prompt: `Caso ${index + 1}`, kind: "choice", options: ["Alternativa A", "Alternativa B"],
  })),
};

describe("pretest desde el navegador", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(loadBrowserAssessment).mockResolvedValue(form);
  });

  it("conserva el identificador y el inicio del cronómetro al recargar", async () => {
    const initial = render(<StudentAssessmentPage token={token} />);
    expect(await screen.findByText("Tiempo transcurrido")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Análisis de situaciones" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uso educativo" })).toBeInTheDocument();
    const [seenToken, browser] = vi.mocked(loadBrowserAssessment).mock.calls[0]!;
    expect(seenToken).toBe(token);
    expect(localStorage.getItem(startKey)).not.toBeNull();
    // Simula que han pasado al menos dos minutos entre abrir y recargar.
    const started = String(Date.now() - 120_000);
    localStorage.setItem(startKey, started);
    initial.unmount();

    render(<StudentAssessmentPage token={token} />);
    const time = await screen.findByText("2:00");
    expect(time).toHaveAttribute("dateTime", "PT120S");
    expect(localStorage.getItem(startKey)).toBe(started);
    expect(loadBrowserAssessment).toHaveBeenLastCalledWith(token, browser);
  });

  it.each([
    [0, "Inicial", "red"], [3, "Básico", "orange"], [5, "En desarrollo", "yellow"],
    [8, "Competente", "blue"], [10, "Avanzado", "green"],
  ])("muestra el resultado %i y no vuelve a abrir el intento", async (score, level, tone) => {
    vi.mocked(loadBrowserAssessment).mockResolvedValue({ state: "submitted", title: form.title, score });
    render(<StudentAssessmentPage token={token} />);
    await screen.findByText("Tus respuestas ya están registradas.");
    const receipt = screen.getByRole("status");
    expect(within(receipt).getByText(level, { exact: false })).toHaveAttribute("data-tone", tone);
    expect(within(receipt).getByText(`${score}/10`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar respuestas" })).not.toBeInTheDocument();
  });
});
