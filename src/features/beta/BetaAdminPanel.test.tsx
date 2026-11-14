import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BetaAdminPanel } from "./BetaAdminPanel";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../lib/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));
it("authorizes an email and pauses AI through server RPCs", async () => {
  mock.rpc.mockImplementation((name: string) =>
    Promise.resolve({
      error: null,
      data: name === "admin_beta_overview"
        ? { ai_enabled: true, members: [], invitations: [] }
        : null,
    })
  );
  render(<BetaAdminPanel />);
  await screen.findByRole("button", { name: "Pausar toda la IA" });
  fireEvent.change(screen.getByLabelText("Correo de la persona invitada"), {
    target: { value: "person@example.invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Autorizar acceso" }));
  await screen.findByText(/Acceso autorizado/);
  expect(mock.rpc).toHaveBeenCalledWith("admin_invite_beta", {
    p_email: "person@example.invalid",
  });
  fireEvent.click(screen.getByRole("button", { name: "Pausar toda la IA" }));
  await waitFor(() =>
    expect(mock.rpc).toHaveBeenCalledWith("admin_set_beta_ai_enabled", {
      p_enabled: false,
    })
  );
});
