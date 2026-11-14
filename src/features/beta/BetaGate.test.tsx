import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BetaGate } from "./BetaGate";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
}));
it("times out a stalled access check and ignores its late result",async()=>{
  vi.useFakeTimers();
  let resolve!: (value:unknown)=>void;
  mock.rpc.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  try {
    const view=render(<BetaGate><p>Contenido privado</p></BetaGate>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(10001);});
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo verificar tu invitación");
    await act(async()=>{resolve({data:{allowed:true,is_admin:false},error:null});await Promise.resolve();});
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
    view.unmount();
  } finally {vi.useRealTimers();}
});
vi.mock("../../lib/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));
vi.mock(
  "../auth/AuthProvider",
  () => ({
    useAuth: () => ({ user: { id: "beta-test-user" }, signOut: mock.signOut }),
  }),
);
it("does not mount remote content until the server verifies membership", async () => {
  mock.rpc.mockResolvedValue({
    data: { allowed: false, is_admin: false },
    error: null,
  });
  render(
    <BetaGate>
      <p>Contenido privado</p>
    </BetaGate>,
  );
  expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
  await screen.findByText(/Esta cuenta necesita una invitación/);
  mock.rpc.mockResolvedValue({
    data: { allowed: true, is_admin: false },
    error: null,
  });
  fireEvent.click(screen.getByRole("button", { name: "Reintentar acceso" }));
  await waitFor(() =>
    expect(screen.getByText("Contenido privado")).toBeInTheDocument()
  );
});
