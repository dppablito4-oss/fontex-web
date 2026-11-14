import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";
function Broken(): never {
  throw Error("private content must not be logged by our boundary");
}
it("offers recovery after a rendering failure and reads only the current account cache", () => {
  const logging = vi.spyOn(console, "error").mockImplementation(() => {});
  localStorage.setItem("sb-example-auth-token", "secret");
  render(
    <AppErrorBoundary>
      <Broken />
    </AppErrorBoundary>,
  );
  expect(screen.getByRole("heading", { name: "No pudimos mostrar esta vista" }))
    .toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Descargar copia local" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "No se encontró una copia local para esta cuenta.",
  );
  expect(localStorage.getItem("sb-example-auth-token")).toBe("secret");
  expect(logging).toHaveBeenCalledWith(
    JSON.stringify({ event: "frontend_render_failed", name: "Error" }),
  );
  logging.mockRestore();
});
