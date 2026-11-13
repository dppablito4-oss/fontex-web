import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
import { createDocument } from "../../core/object-registry/registry";
import type { AgentRequest } from "../../core/agent/protocol";
import { requestAgent } from "./agentService";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock(
  "../../lib/supabase/client",
  () => ({ supabase: { functions: { invoke } } }),
);
const request = (): AgentRequest => ({
  document: createDocument(),
  selectedId: null,
  mode: "learn",
  level: "primary",
  question: "Explica",
  attempt: "",
  hintLevel: 0,
});
beforeEach(() => invoke.mockReset());
it("conserva práctica local sin red ni proveedor", async () => {
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    const input = request();
    input.selectedId = input.document.objects[0]!.id;
    expect((await requestAgent({ ...input, mode: "practice" })).message)
      .toContain("Calcula");
    await expect(requestAgent(input)).rejects.toThrow(/No hay conexión/);
    expect(invoke).not.toHaveBeenCalled();
  } finally {
    online.mockRestore();
  }
});
it("invoca únicamente el backend y valida la respuesta antes de aplicarla", async () => {
  const input = request();
  invoke.mockResolvedValueOnce({
    data: {
      message: "ok",
      batch: { documentId: input.document.id, actions: [] },
      verification: [],
    },
    error: null,
  });
  await expect(requestAgent(input)).resolves.toMatchObject({ message: "ok" });
  expect(invoke).toHaveBeenCalledWith("studio-agent", {
    body: input,
    timeout: 55_000,
  });
  invoke.mockResolvedValueOnce({ data: { code: "eval()" }, error: null });
  await expect(requestAgent(input)).rejects.toThrow(/propuesta válida/);
});
it.each([
  [400, /consulta más breve/],
  [401, /Inicia sesión/],
  [403, /Inicia sesión/],
  [404, /aún no está disponible/],
  [422, /propuesta válida/],
  [429, /límite de consultas/],
  [502, /proveedor de IA/],
  [503, /no está disponible en el servidor/],
  [504, /tardó demasiado/],
] as const)(
  "muestra errores seguros del backend (%i)",
  async (status, message) => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(new Response(null, { status })),
    });
    await expect(requestAgent(request())).rejects.toThrow(message);
  },
);
it("distingue un fallo de conexión y no muestra errores internos del servidor", async () => {
  invoke.mockResolvedValueOnce({
    data: null,
    error: new FunctionsFetchError(new Error("private provider details")),
  });
  await expect(requestAgent(request())).rejects.toThrow(/conectar con el agente/);
  invoke.mockResolvedValueOnce({
    data: null,
    error: new FunctionsHttpError(Response.json({ message: "private provider details" }, { status: 500 })),
  });
  await expect(requestAgent(request())).rejects.toThrow(/El material no cambió/);
});
it("explica un paso local sin sesión ni red y sin llamar a la IA", async () => {
  const online = vi.spyOn(navigator,"onLine","get").mockReturnValue(false);
  try {
    const input=request();input.selectedId=input.document.objects[0]!.id;input.question="Explica solo el paso 2";
    const reply=await requestAgent(input);
    expect(reply.message).toContain("Paso 2:");expect(reply.batch.actions).toEqual([]);expect(invoke).not.toHaveBeenCalled();
  } finally { online.mockRestore(); }
});

it("entrega texto antes de la respuesta final y no acepta una transmisión incompleta", async () => {
  const input = request(), onText = vi.fn();
  let streamController!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { streamController = controller; } });
  const send = (value: unknown) => streamController.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`));
  invoke.mockResolvedValueOnce({ data: new Response(body, { headers: { "Content-Type": "text/event-stream" } }), error: null });
  const result = requestAgent(input, { onText });
  send({ type: "text", text: "La recta" });
  await vi.waitFor(() => expect(onText).toHaveBeenCalledWith("La recta"));
  send({ type: "done", reply: { message: "La recta numérica.", batch: { documentId: input.document.id, actions: [] }, verification: [] } });
  streamController.close();
  await expect(result).resolves.toMatchObject({ message: "La recta numérica." });
  invoke.mockResolvedValueOnce({ data: new Response('data: {"type":"text","text":"Parcial"}\n\n', { headers: { "Content-Type": "text/event-stream" } }), error: null });
  await expect(requestAgent(input, { onText })).rejects.toThrow(/interrumpió/);
});
