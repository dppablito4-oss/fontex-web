import { describe, expect, it } from "vitest";
import { createDocument, createObject } from "../object-registry/registry";
import { equivalentAnswer, levelGuidance, practiceReply } from "./pedagogy";
import {
  agentLevels,
  type AgentRequest,
  parseAgentReply,
  parseAgentRequest,
} from "./protocol";

export function practiceRequest(): AgentRequest {
  const document = createDocument();
  return {
    document,
    selectedId: document.objects[0]!.id,
    question: "Ayúdame",
    attempt: "",
    mode: "practice",
    level: "primary",
    hintLevel: 0,
  };
}
describe("Flujos pedagógicos", () => {
  it.each(Object.keys(agentLevels) as (keyof typeof agentLevels)[])(
    "adapta el acompañamiento a %s sin cambiar la exactitud",
    (level) => {
      const request = { ...practiceRequest(), level };
      const first = practiceReply(request);
      const second = practiceReply({ ...request, hintLevel: 1 });
      const last = practiceReply({ ...request, hintLevel: 2 });
      expect(first.message).not.toContain("7/6");
      expect(second.message).not.toContain("7/6");
      expect(last.message).toContain("7/6");
      expect(first.batch.actions).toEqual([]);
      expect(first.verification).toEqual([]);
      expect(levelGuidance[level].length).toBeGreaterThan(30);
    },
  );
  it("comprueba equivalencias y corrige sin revelar antes la solución", () => {
    const request = practiceRequest();
    expect(practiceReply({ ...request, attempt: "14/12" }).message).toContain(
      "equivalente al resultado",
    );
    const wrong = practiceReply({ ...request, attempt: "2/9" });
    expect(wrong.message).toContain("aún no coincide");
    expect(wrong.message).not.toContain("7/6");
    expect(practiceReply({ ...request, attempt: "7/0" }).message).toContain(
      "distinto de cero",
    );
    expect(equivalentAnswer("-2/-4", { n: 1, d: 2 })).toBe(true);
    expect(equivalentAnswer("1/2; alert(1)", { n: 1, d: 2 })).toBeNull();
  });
  it("practica el siguiente término de una sucesión y no evalúa texto libre", () => {
    const request = practiceRequest();
    const sequence = createObject("sequence");
    request.document.objects.push(sequence);
    expect(
      practiceReply({ ...request, selectedId: sequence.id, hintLevel: 2 })
        .message,
    ).toContain("Comprobación: 12");
    expect(
      practiceReply({ ...request, selectedId: request.document.objects[1]!.id })
        .message,
    ).toContain("no se evalúa");
  });
  it("valida modos, niveles, pistas, selección y respuesta del backend", () => {
    const request = practiceRequest();
    expect(parseAgentRequest(request).mode).toBe("practice");
    for (
      const patch of [
        { mode: "execute" },
        { level: "doctorado" },
        { hintLevel: 3 },
        { selectedId: "missing" },
        { question: "" },
      ]
    ) {
      expect(() => parseAgentRequest({ ...request, ...patch })).toThrow();
    }
    expect(() =>
      parseAgentReply({
        message: "ok",
        batch: { documentId: "other", actions: [] },
        verification: [],
      }, request.document)
    ).toThrow(/otro material/);
    expect(
      parseAgentReply(practiceReply(request), request.document).batch.actions,
    ).toEqual([]);
  });
  it.each(
    [
      ["collection", "20"],
      ["number-line", "10"],
      ["linear-equation", "4"],
    ] as const,
  )("ofrece práctica exacta para %s", (type, expected) => {
    const request = practiceRequest();
    const object = createObject(type);
    request.document.objects.push(object);
    const reply = practiceReply({
      ...request,
      selectedId: object.id,
      attempt: expected,
      hintLevel: 2,
    });
    expect(reply.message).toContain("equivalente al resultado");
    expect(reply.message).toContain(`Comprobación: ${expected}`);
  });
  it.each([[1, 2, "sin solución"], [1, 1, "infinitas"]])(
    "evalúa clasificaciones de ecuaciones degeneradas",
    (b, d, attempt) => {
      const request = practiceRequest();
      const object = createObject("linear-equation");
      if (object.type !== "linear-equation") throw new Error("Tipo inesperado");
      object.data = { a: 2, b: Number(b), c: 2, d: Number(d), stage: 0 };
      request.document.objects.push(object);
      expect(
        practiceReply({
          ...request,
          selectedId: object.id,
          attempt: String(attempt),
        }).message,
      ).toContain("equivalente al resultado");
    },
  );
  it("usa acompañamiento concreto para inicial antes de introducir notación", () => {
    const request = practiceRequest();
    expect(
      practiceReply({ ...request, level: "initial", hintLevel: 1 }).message,
    ).toContain("pide ayuda");
  });
});
