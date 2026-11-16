import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { JoinClassroomPage } from "./JoinClassroomPage";
import { ThemeProvider } from "../theme/ThemeProvider";

const mocked = vi.hoisted(() => ({ rpc: vi.fn(), signUp: vi.fn(), signIn: vi.fn(), user: null as { id: string } | null }));
vi.mock("../../lib/supabase/client", () => ({ supabase: { rpc: mocked.rpc } }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ status: mocked.user ? "authenticated" : "anonymous", user: mocked.user, signUp: mocked.signUp, signIn: mocked.signIn }) }));
function open(route = "/unirse?invite=abc") {
  return render(<ThemeProvider><MemoryRouter initialEntries={[route]}><Routes><Route path="unirse" element={<JoinClassroomPage />} /><Route path="aula" element={<p>Dentro del aula</p>} /></Routes></MemoryRouter></ThemeProvider>);
}
beforeEach(() => { localStorage.clear(); mocked.user = null; mocked.rpc.mockReset(); });
it("asks only the name before temporary participation", async () => {
  mocked.rpc.mockImplementation((method: string) => Promise.resolve({ error: null, data: method === "get_classroom_join_info" ? { title: "Clase modelo" } : { id: "c1a55000-0000-4000-8000-000000000001", token: "a".repeat(64), display_name: "Ana", classroom_id: "c1a55000-0000-4000-8000-000000000002", title: "Clase modelo", expires_at: "2026-12-01T00:00:00Z" } }));
  open();
  await screen.findByRole("heading", { name: "Clase modelo" });
  expect(screen.queryByLabelText("Correo")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tu nombre"), { target: { value: "Ana" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar a la clase" }));
  expect(await screen.findByText("Dentro del aula")).toBeInTheDocument();
  expect(mocked.rpc).toHaveBeenCalledWith("start_classroom_guest", { p_invite: "abc", p_name: "Ana" });
});
it("redeems an existing account's link directly", async () => {
  mocked.user = { id: "account" };
  mocked.rpc.mockImplementation((method: string) => Promise.resolve({ error: null, data: method === "get_classroom_join_info" ? { title: "Clase modelo" } : "classroom" }));
  open();
  expect(await screen.findByText("Dentro del aula")).toBeInTheDocument();
  expect(mocked.rpc).toHaveBeenCalledWith("join_classroom_by_invite", { p_invite: "abc" });
  expect(mocked.rpc).not.toHaveBeenCalledWith("start_classroom_guest", expect.anything());
});
it("rejects expired invitations without showing a name form", async () => {
  mocked.rpc.mockResolvedValue({ data: null, error: null });
  open();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("venció"));
  expect(screen.queryByLabelText("Tu nombre")).not.toBeInTheDocument();
});
