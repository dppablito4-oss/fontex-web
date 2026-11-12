import { FunctionsHttpError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findCitation, requestTutor, tutorAvailable } from "./demoService";
import lessons from "../../../supabase/functions/_shared/practice/lessons.json";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../../lib/supabase/client", () => ({ supabase: { functions: { invoke } } }));

beforeEach(() => {
  invoke.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
});
afterEach(() => vi.unstubAllGlobals());

describe("Conexión del tutor de práctica", () => {
  it("incluye la fórmula de la misma página al preguntar por la derivada", () => {
    const lesson = lessons.find(item => item.id === "universidad-cambio")!;
    const citation = findCitation("¿Cuál es la derivada de x² en a = 3?", lesson);
    expect(citation).toMatchObject({ sourceId: lesson.id, page: 2 });
    expect(citation?.excerpt).toContain("f′(3) = 6");
  });

  it("acota los PDF largos y conserva la página y documento seleccionados", () => {
    const lesson = lessons.find(item => item.id === "universidad-cambio")!;
    const citation = findCitation("derivada", lesson, {
      id: "pdf-propio", title: "Mi lectura", filename: "mi-lectura.pdf", pdf: new Blob(),
      pages: [{ pageNumber: 7, text: "derivada ".repeat(500) }, { pageNumber: 8, text: "Otra lectura sin relación." }],
    });
    expect(citation).toMatchObject({ sourceId: "pdf-propio", page: 7 });
    expect(citation!.excerpt.length).toBeLessThanOrEqual(2800);
    expect(citation!.excerpt).not.toContain("Otra lectura");
  });

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
