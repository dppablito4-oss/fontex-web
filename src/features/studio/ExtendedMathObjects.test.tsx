import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MathObjectRenderer } from "./MathObjectRenderer";
import { createObject } from "../../core/object-registry/registry";

it.each([[1, 2, "Sin solución"], [3, 3, "Infinitas soluciones en ℝ"]])(
  "representa ecuaciones degeneradas con explicación",
  (b, d, expected) => {
    const object = createObject("linear-equation");
    if (object.type !== "linear-equation") throw new Error("Tipo inesperado");
    object.data = { a: 2, b: Number(b), c: 2, d: Number(d), stage: 2 };
    render(<MathObjectRenderer object={object} onChange={vi.fn()} />);
    expect(screen.getByText(String(expected))).toBeInTheDocument();
  },
);
