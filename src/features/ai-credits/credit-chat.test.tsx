import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PrimitiveCanvas } from "../primitives/PrimitiveCanvas";
import { ThemeProvider } from "../theme/ThemeProvider";
const request = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    message: "Puedes seguir conversando.",
    actions: [],
  })
);
vi.mock(
  "../auth/AuthProvider",
  () => ({
    useAuth: () => ({
      status: "authenticated",
      user: { id: "credit-user", email: "tester@example.invalid" },
      profile: { displayName: "Prueba" },
      signOut: vi.fn(),
    }),
  }),
);
vi.mock("../../lib/supabase/client", () => ({ supabase: null }));
vi.mock("../beta/useBetaAccess", () => ({useBetaAccess:()=>({status:"allowed",refresh:vi.fn()})}));
vi.mock(
  "./useAiCredits",
  () => ({
    useAiCredits: () => ({
      status: {
        balance: 0,
        initial_credits: 5,
        is_admin: false,
        active_generation: false,
      },
      error: null,
      refresh: vi.fn(),
    }),
  }),
);
vi.mock("../primitives/agent", () => ({ requestPrimitiveAgent: request }));
it("keeps chat enabled when generation credit is zero", async () => {
  render(
    <ThemeProvider>
      <PrimitiveCanvas />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Chat" }));
  expect(screen.getByText("0 créditos para generar")).toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Mensaje para Fontex AI" }),
    { target: { value: "Ayúdame a entender fracciones" } },
  );
  expect(screen.getByRole("button", { name: "Crear lienzo" }))
    .toBeDisabled();
  expect(screen.getByRole("button", { name: "Enviar" }))
    .toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await screen.findByText("Puedes seguir conversando.");
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(request.mock.calls[0]![0]).toMatchObject({ task: "chat" });
});
