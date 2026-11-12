import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AcademicMarkdown } from "./AcademicMarkdown";
import type { TutorCitation } from "../types";

describe("AcademicMarkdown", () => {
  it("renderiza exponentes completos y simbólicos con MathML accesible", () => {
    const { container } = render(<AcademicMarkdown content="$x^0 + x^1 + x^4 + x^{10} + x^{24} + x^{-12} + x^n$" />);
    expect(container.querySelectorAll("math msup")).toHaveLength(7);
    expect(container.querySelector("math")).toHaveTextContent("24");
    expect(container.querySelector(".katex-error")).toBeNull();
  });
  it("renderiza texto simple, negrita y código en línea", () => {
    const text = "Este es un **concepto clave** con `código inline` y texto normal.";
    render(<AcademicMarkdown content={text} />);

    expect(screen.getByText("concepto clave")).toBeInTheDocument();
    expect(screen.getByText("código inline")).toBeInTheDocument();
  });

  it("formatea expresiones matemáticas LaTeX inline y de bloque", () => {
    const text = "La relación es $F = m \\cdot a$ y la integral es $$\\int x dx$$.";
    const { container } = render(<AcademicMarkdown content={text} />);

    expect(container.querySelectorAll("math")).toHaveLength(2);
    expect(container.querySelectorAll("math")[1]).toHaveTextContent("∫");
  });

  it("renderiza fracciones anidadas con delimitadores TeX simples y dobles", () => {
    const { container } = render(<AcademicMarkdown content={String.raw`Divide: \(\frac{6}{8}\).

\\[
\\frac{6 \\div 2}{8 \\div 2} = \\frac{3}{4}
\\]`} />);
    expect(container.querySelectorAll("math mfrac")).toHaveLength(3);
    expect(container.querySelector(".katex-error")).toBeNull();
    expect(container.querySelectorAll(".katex-display")).toHaveLength(1);
  });

  it("deja intacta la notación dentro de bloques de código", () => {
    render(<AcademicMarkdown content={'`\\(x\\)`\n\n```tex\n\\[\\frac{1}{2}\\]\n```'} />);
    expect(screen.queryByRole("math")).not.toBeInTheDocument();
    expect(screen.getByText('\\[\\frac{1}{2}\\]')).toBeInTheDocument();
  });

  it("renderiza listas y enlaces sin ejecutar HTML ni protocolos peligrosos", () => {
    const { container } = render(<AcademicMarkdown content={'1. **Lee** la fuente.\n2. [Consultar](https://example.org)\n\n[No abrir](javascript:alert%281%29)\n\n<img src=x onerror=alert(1)>\n\n$\\href{javascript:alert(1)}{texto}$'} />);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Consultar" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container.querySelector("img")).toBeNull();
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
