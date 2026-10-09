import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AcademicMarkdown } from "./AcademicMarkdown";
import type { TutorCitation } from "../types";

describe("AcademicMarkdown", () => {
  it("renderiza texto simple, negrita y código en línea", () => {
    const text = "Este es un **concepto clave** con `código inline` y texto normal.";
    render(<AcademicMarkdown content={text} />);

    expect(screen.getByText("concepto clave")).toBeInTheDocument();
    expect(screen.getByText("código inline")).toBeInTheDocument();
  });

  it("formatea expresiones matemáticas LaTeX inline y de bloque", () => {
    const text = "La relación es $F = m \\cdot a$ y la integral es $$\\int x dx$$.";
    render(<AcademicMarkdown content={text} />);

    // Should contain rendered unicode symbols
    expect(screen.getByText(/F = m · a/)).toBeInTheDocument();
    expect(screen.getByText(/∫ x dx/)).toBeInTheDocument();
  });

  it("renderiza bloques de citas verificadas y llama al callback al hacer clic", () => {
    const citations: TutorCitation[] = [
      {
        chunkId: 101,
        documentId: "doc-123",
        documentTitle: "Física I - Dinámica",
        pageStart: 14,
        pageEnd: 15,
      },
    ];

    const onOpen = vi.fn();
    render(
      <AcademicMarkdown
        content="Según la segunda ley, la fuerza neta produce una aceleración proporcional a la masa."
        citations={citations}
        onOpenCitation={onOpen}
      />,
    );

    expect(screen.getByText("Fuentes verificadas (1)")).toBeInTheDocument();
    const citationButton = screen.getByRole("button", { name: /Física I - Dinámica/i });
    expect(citationButton).toBeInTheDocument();
    expect(screen.getByText("· págs. 14–15")).toBeInTheDocument();

    fireEvent.click(citationButton);
    expect(onOpen).toHaveBeenCalledWith(citations[0]);
  });
});
