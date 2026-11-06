import { FunctionsHttpError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestTutor, tutorAvailable } from "./demoService";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../../lib/supabase/client", () => ({ supabase: { functions: { invoke } } }));

beforeEach(() => {
  invoke.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
});
afterEach(() => vi.unstubAllGlobals());

describe("Conexión del tutor de práctica", () => {
  it("conserva la búsqueda local para visitantes sin consultar el servidor", async () => {
    expect(await tutorAvailable(false)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("habilita Supabase para una sesión y envía el fragmento de referencia", async () => {
    invoke.mockResolvedValueOnce({ data: { available: true }, error: null });
    expect(await tutorAvailable(true)).toBe("supabase");
    expect(invoke).toHaveBeenCalledWith("practice-tutor", { body: { action: "health" }, timeout: 8000 });

    const input = { mode: "study" as const, topic: "fracciones", question: "¿Cómo se simplifica?", evidence: "Divide ambos términos." };
    const reply = { text: "Divide entre el mismo número.", sources: [] };
    invoke.mockResolvedValueOnce({ data: reply, error: null });
    expect(await requestTutor(input, "supabase")).toEqual(reply);
    expect(invoke).toHaveBeenLastCalledWith("practice-tutor", { body: input, timeout: 36_000 });
  });

  it("informa cuando la cuenta alcanza el límite de consultas", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(new Response(null, { status: 429 })) });
    await expect(requestTutor({ mode: "chat", topic: "fracciones", question: "Hola" }, "supabase")).rejects.toThrow("límite de consultas");
  });
});
