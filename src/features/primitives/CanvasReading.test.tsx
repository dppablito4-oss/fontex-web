import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CanvasReading, SharedCanvasPage } from "./CanvasReading";
import { templateScene } from "../../core/primitives/templates";
import { readPublicCanvas } from "./sharing";
vi.mock("./sharing", () => ({ readPublicCanvas: vi.fn() }));
vi.mock("../../components/ProductNavigation", () => ({ SiteHeader: () => <header>Fontex</header> }));
it("opens a shared canvas in read-only mode without entering an account", async () => {
  const scene = templateScene("fractions");
  vi.mocked(readPublicCanvas).mockResolvedValue(scene);
  const { container } = render(<SharedCanvasPage token="link-token" />);
  await screen.findByRole("heading", { name: scene.title });
  expect(readPublicCanvas).toHaveBeenCalledWith("link-token");
  expect(container.querySelector("svg")).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Texto y fórmula" })).toBeNull();
});
it("explains when a shared link is unavailable", async () => {
  vi.mocked(readPublicCanvas).mockRejectedValue(Error("Enlace desactivado"));
  render(<SharedCanvasPage token="revoked-token" />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Enlace desactivado"));
});

it("alternates the definition, its models, the next explanation and its operation", () => {
  const { container } = render(<CanvasReading scene={templateScene("sum")} />);
  const items = [...container.querySelectorAll(".pc-export-item")];
  expect(items[0]).toHaveTextContent("1. Entendemos las partes");
  expect(items[0]!.querySelectorAll(".pc-circles")).toHaveLength(2);
  const operation = items.find(item => item.textContent?.includes("2. Reunimos partes iguales"))!;
  expect(operation.querySelectorAll(".pc-circles")).toHaveLength(3);
  expect(items.indexOf(operation)).toBeGreaterThan(0);
  expect(items.at(-1)).toHaveTextContent("3. Interpretamos el resultado");
});
