import { FunctionsHttpError } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
import { createDocument } from "../../core/object-registry/registry";
import type { AgentRequest } from "../../core/agent/protocol";
import { requestAgent } from "./agentService";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../../lib/supabase/client", () => ({ supabase: { functions: { invoke } } }));
const request = (): AgentRequest => ({ document: createDocument(), selectedId: null, mode: "learn", level: "primary", question: "Explica", attempt: "", hintLevel: 0 });
beforeEach(() => invoke.mockReset());
it("conserva práctica local sin red ni proveedor", async () => {
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    const input = request(); input.selectedId = input.document.objects[0]!.id;
    expect((await requestAgent({ ...input, mode: "practice" })).message).toContain("Calcula");
    await expect(requestAgent(input)).rejects.toThrow(/No hay conexión/);
    expect(invoke).not.toHaveBeenCalled();
  } finally { online.mockRestore(); }
});
it("invoca únicamente el backend y valida la respuesta antes de aplicarla", async () => {
  const input = request();
  invoke.mockResolvedValueOnce({ data: { message: "ok", batch: { documentId: input.document.id, actions: [] }, verification: [] }, error: null });
  await expect(requestAgent(input)).resolves.toMatchObject({ message: "ok" });
  expect(invoke).toHaveBeenCalledWith("studio-agent", { body: input, timeout: 36_000 });
  invoke.mockResolvedValueOnce({ data: { code: "eval()" }, error: null });
  await expect(requestAgent(input)).rejects.toThrow(/propuesta válida/);
});
it.each([401, 429, 503])("muestra errores seguros del backend (%i)", async status => {
  invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(new Response(null, { status })) });
  await expect(requestAgent(request())).rejects.toThrow();
});
