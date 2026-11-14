import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PrimitiveCanvas } from "./PrimitiveCanvas";
import { ThemeProvider } from "../theme/ThemeProvider";
import { primitiveNames } from "../../core/primitives/schema";

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ status: "anonymous", user: null, profile: null, signOut: vi.fn() }) }));
vi.mock("../../lib/supabase/client", () => ({ supabase: null }));

function editor() { render(<ThemeProvider><PrimitiveCanvas /></ThemeProvider>); }

it("keeps the chat available while tools open, and restores its draft after hiding it", () => {
  editor();
  const message = screen.getByRole("textbox", { name: "Mensaje para Fontex AI" });
  fireEvent.change(message, { target: { value: "Explica las áreas" } });
  fireEvent.click(screen.getByRole("button", { name: "Elementos" }));
  expect(screen.getByRole("log")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Elementos" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Asistente" }));
  expect(screen.queryByRole("log")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Asistente" }));
  expect(screen.getByRole("textbox", { name: "Mensaje para Fontex AI" })).toHaveValue("Explica las áreas");
});

it("creates blank tabs, preserves previous documents and separates their undo history", () => {
  editor();
  const firstTitle = screen.getByRole("tab", { selected: true }).textContent;
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Fontex AI" }), { target: { value: "Primera idea" } });
  fireEvent.click(screen.getByRole("button", { name: "Elementos" }));
  fireEvent.click(within(screen.getByRole("region", { name: "Elementos" })).getByRole("button", { name: primitiveNames.math_block }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nombre del elemento" }), { target: { value: "Mi explicación" } });
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Nuevo lienzo" }));
  expect(screen.getAllByRole("tab")).toHaveLength(2);
  expect(screen.getByRole("textbox", { name: "Mensaje para Fontex AI" })).toHaveValue("");
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Fontex AI" }), { target: { value: "Otra idea" } });
  expect(within(screen.getByRole("main", { name: "Lienzo matemático" })).queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
  fireEvent.click(screen.getByRole("tab", { name: firstTitle }));
  expect(screen.getByRole("textbox", { name: "Mensaje para Fontex AI" })).toHaveValue("Primera idea");
  expect(within(screen.getByRole("main", { name: "Lienzo matemático" })).getByRole("article", { name: "Mi explicación" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
});
