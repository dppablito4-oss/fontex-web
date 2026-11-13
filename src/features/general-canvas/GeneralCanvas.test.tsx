import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { expressionScene, serializeScene } from "../../core/scene/document";
import { ThemeProvider } from "../theme/ThemeProvider";
import { GeneralCanvas } from "./GeneralCanvas";

vi.mock("../../lib/supabase/client", () => ({ supabase: null }));

it("opens exported scenes over 300 KB through the actual file input", async () => {
  const scene = expressionScene("x^2");
  scene.title = "Escena portátil";
  scene.conversation = Array.from({ length: 80 }, () => ({ role: "assistant" as const, content: "A".repeat(4000) }));
  const text = serializeScene(scene);
  const file = new File([text], "escena.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  render(<ThemeProvider><HashRouter><GeneralCanvas /></HashRouter></ThemeProvider>);
  expect(screen.queryByText("Materiales de la versión anterior")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Archivo de escena"), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(scene.title));
  expect(screen.getByLabelText("Nombre de la escena")).toHaveValue(scene.title);
});
