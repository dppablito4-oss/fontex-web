import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthPage } from "./AuthPage";

describe("Fontex authentication screen", () => {
  it("renders a password sign-in form", () => {
    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: /aprende con tus fuentes/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Correo")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /entrar a fontex/i })).toBeInTheDocument();
  });

  it("requires a display name when creating an account", () => {
    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByLabelText("Nombre visible")).toBeRequired();
    expect(
      screen.getAllByRole("button", { name: "Crear cuenta" }).find((button) => button.getAttribute("type") === "submit"),
    ).toBeInTheDocument();
  });
});
