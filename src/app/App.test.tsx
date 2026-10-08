import { render, screen } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("Fontex shell", () => {
  it("presenta la identidad y el estado de demostración", () => {
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    );

    expect(screen.getAllByLabelText("Fontex").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /tus fuentes/i })).toBeInTheDocument();
    expect(screen.getByText(/datos ficticios/i)).toBeInTheDocument();
  });
});
