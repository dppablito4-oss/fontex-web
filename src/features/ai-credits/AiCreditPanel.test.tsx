import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AiCreditPanel } from "./AiCreditPanel";
import type { ReactNode } from "react";
vi.mock("../auth/AdminMfaGate", () => ({ AdminMfaGate: ({children}: {children:ReactNode}) => children }));
vi.mock("../beta/CanvasDiagnostics", () => ({ CanvasDiagnostics: () => null }));
const mock = vi.hoisted(() => ({
  status: {
    balance: 5,
    initial_credits: 5,
    is_admin: true,
    active_generation: false,
  },
  list: vi.fn(),
  grant: vi.fn(),
  history: vi.fn(),
  changed: vi.fn(),
}));
vi.mock(
  "./useAiCredits",
  () => ({
    useAiCredits: () => ({
      status: mock.status,
      error: null,
      refresh: vi.fn(),
    }),
  }),
);
vi.mock(
  "./service",
  () => ({
    listCreditAccounts: mock.list,
    grantCredits: mock.grant,
    creditHistory: mock.history,
    creditsChanged: mock.changed,
  }),
);
const account = {
  user_id: "ac810000-0000-4000-8000-000000000002",
  email: "tester@example.invalid",
  display_name: "Persona de prueba",
  credits: 5,
  created_at: "2026-11-14T00:00:00Z",
  is_admin: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.status.is_admin = true;
  mock.list.mockResolvedValue({ accounts: [account], hasMore: false });
  mock.history.mockResolvedValue([]);
  mock.grant.mockResolvedValue({ balance: 10, duplicate: false });
});
it("hides registered accounts and credit assignment from normal users", () => {
  mock.status.is_admin = false;
  render(<AiCreditPanel />);
  expect(screen.getByText("5 créditos disponibles")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Créditos de generación" })).not
    .toBeInTheDocument();
  expect(mock.list).not.toHaveBeenCalled();
});
it("lets the administrator choose an account and add credits", async () => {
  render(<AiCreditPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Cuentas y créditos" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /Persona de prueba/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Añadir créditos" }));
  await screen.findByText(/Asignación confirmada/);
  expect(mock.grant).toHaveBeenCalledWith(
    account.user_id,
    5,
    "Asignación manual",
    expect.any(String),
  );
  expect(mock.changed).toHaveBeenCalledTimes(1);
});
it("reuses a grant request after a failed network confirmation", async () => {
  mock.grant.mockRejectedValueOnce(new Error("No se pudo confirmar"))
    .mockResolvedValueOnce({ balance: 10, duplicate: true });
  render(<AiCreditPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Cuentas y créditos" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /Persona de prueba/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Añadir créditos" }));
  await screen.findByRole("alert");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Añadir créditos" }))
      .toBeEnabled()
  );
  fireEvent.click(screen.getByRole("button", { name: "Añadir créditos" }));
  await screen.findByText(/Asignación confirmada/);
  expect(mock.grant.mock.calls[0]![3]).toBe(mock.grant.mock.calls[1]![3]);
});
