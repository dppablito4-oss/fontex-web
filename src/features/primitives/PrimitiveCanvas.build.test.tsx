import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PrimitiveCanvas } from "./PrimitiveCanvas";
import { ThemeProvider } from "../theme/ThemeProvider";
import { createPrimitive, newPrimitiveScene, type PrimitiveReply, type PrimitiveScene } from "../../core/primitives/schema";

const mock = vi.hoisted(() => ({ access: "allowed", request: vi.fn() }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ status: "authenticated", user: { id: "build-user" }, profile: null, signOut: vi.fn() }) }));
vi.mock("../../lib/supabase/client", () => ({ supabase: null }));
vi.mock("../beta/useBetaAccess", () => ({ useBetaAccess: () => ({ status: mock.access, lastVerifiedAllowed: true, refresh: vi.fn() }) }));
vi.mock("../ai-credits/useAiCredits", () => ({ useAiCredits: () => ({ status: { balance: 5, active_generation: false, is_admin: false }, error: null, refresh: vi.fn() }) }));
vi.mock("./agent", () => ({ requestPrimitiveAgent: mock.request }));
const tree = () => <ThemeProvider><PrimitiveCanvas /></ThemeProvider>;
function construction(scene: PrimitiveScene): PrimitiveReply {
  const primitive = createPrimitive("math_block", scene);
  primitive.label = "Suma de fracciones creada";
  return { message: "La explicación está en el lienzo.", actions: [{ kind: "add_primitive", primitive }] };
}
beforeEach(() => { mock.access = "allowed"; mock.request.mockReset(); });

it("submits a desktop Enter once, preserves Shift Enter and ignores IME composition and held Enter", async () => {
  const original = Object.getOwnPropertyDescriptor(window, "matchMedia")!;
  const media = window.matchMedia("");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn((query: string) => ({
    ...media, media: query, matches: query === "(hover:hover) and (pointer:fine)",
  })) });
  let complete!: (reply: PrimitiveReply) => void;
  mock.request.mockImplementation(() => new Promise<PrimitiveReply>(resolve => { complete = resolve; }));
  try {
    render(tree());
    const message = screen.getByRole("textbox", { name: "Mensaje para Fontex AI" });
    fireEvent.change(message, { target: { value: "Crea una explicación visual" } });
    fireEvent.keyDown(message, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(message, { key: "Enter", isComposing: true });
    fireEvent.keyDown(message, { key: "Enter", repeat: true });
    expect(mock.request).not.toHaveBeenCalled();
    fireEvent.keyDown(message, { key: "Enter" });
    fireEvent.keyDown(message, { key: "Enter" });
    expect(mock.request).toHaveBeenCalledTimes(1);
    const input = mock.request.mock.calls[0]![0] as { scene: PrimitiveScene };
    expect(input).toMatchObject({ task: "build", question: "Crea una explicación visual" });
    await act(async () => { complete(construction(input.scene)); await Promise.resolve(); });
    expect(await screen.findByRole("article", { name: "Suma de fracciones creada" })).toBeInTheDocument();
  } finally { Object.defineProperty(window, "matchMedia", original); }
});

it("applies a construction even if a background membership check temporarily fails", async () => {
  let complete!: (reply: PrimitiveReply) => void;
  mock.request.mockImplementation(() => new Promise<PrimitiveReply>((resolve) => { complete = resolve; }));
  const view = render(tree());
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Fontex AI" }), { target: { value: "Una suma de fracciones" } });
  fireEvent.click(screen.getByRole("button", { name: "Crear con IA" }));
  const input = mock.request.mock.calls[0]![0] as { scene: PrimitiveScene };
  mock.access = "error";
  view.rerender(tree());
  await act(async () => { complete(construction(input.scene)); await Promise.resolve(); });
  mock.access = "allowed";
  view.rerender(tree());
  expect(await screen.findByRole("article", { name: "Suma de fracciones creada" })).toBeInTheDocument();
});

it("routes a direct creation command to build and applies the returned objects", async () => {
  mock.request.mockImplementation((input: { scene: PrimitiveScene }) => Promise.resolve(construction(input.scene)));
  render(tree());
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Fontex AI" }), { target: { value: "Crea una explicación visual de suma de fracciones" } });
  fireEvent.submit(screen.getByRole("textbox", { name: "Mensaje para Fontex AI" }).closest("form")!);
  expect(mock.request.mock.calls[0]![0]).toMatchObject({ task: "build" });
  expect(await screen.findByRole("article", { name: "Suma de fracciones creada" })).toBeInTheDocument();
});

it("can retry the unfinished creation already saved in the conversation", async () => {
  const scene = newPrimitiveScene();
  scene.conversation = [{ role: "user", content: "Construye la suma de fracciones en el lienzo" }];
  localStorage.setItem("fontex-primitives-v2:build-user", JSON.stringify({ activeId: scene.id, scenes: [scene] }));
  mock.request.mockImplementation((input: { scene: PrimitiveScene }) => Promise.resolve(construction(input.scene)));
  render(tree());
  fireEvent.click(screen.getByRole("button", { name: "Reintentar construcción" }));
  expect(mock.request.mock.calls[0]![0]).toMatchObject({ task: "build", question: scene.conversation[0]!.content });
  expect(await screen.findByRole("article", { name: "Suma de fracciones creada" })).toBeInTheDocument();
  expect(screen.getAllByText(scene.conversation[0]!.content)).toHaveLength(1);
});

it("does not claim a streamed construction is ready before its elements are validated and applied",async()=>{
  let complete!:(reply:PrimitiveReply)=>void;
  mock.request.mockImplementation((_input:unknown,onText:(s:string)=>void)=>{
    onText("He creado todos los elementos.");return new Promise<PrimitiveReply>(resolve=>{complete=resolve;});
  });
  render(tree());
  fireEvent.change(screen.getByRole("textbox",{name:"Mensaje para Fontex AI"}),{target:{value:"Crea un ejercicio completo"}});
  fireEvent.submit(screen.getByRole("textbox",{name:"Mensaje para Fontex AI"}).closest("form")!);
  expect(screen.queryByText("He creado todos los elementos.")).not.toBeInTheDocument();
  expect(screen.getByText("Generando y validando los elementos del ejercicio…")).toBeInTheDocument();
  const input=mock.request.mock.calls[0]![0] as {scene:PrimitiveScene};
  await act(async()=>{complete(construction(input.scene));await Promise.resolve();});
  expect(await screen.findByRole("article",{name:"Suma de fracciones creada"})).toBeInTheDocument();
});
