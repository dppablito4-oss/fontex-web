import { describe, expect, it } from "vitest";
import { BOARD, MAX_OBJECTS, fitObject, parseDocument } from "./document";
import { createDocument, createObject } from "../object-registry/registry";
import { sequenceTerms } from "../math-engine/sequences";

describe("Documentos matemáticos versionados", () => {
  it("serializa fracciones, textos y sucesiones con el mismo esquema", () => {
    const document = createDocument("blank");
    document.objects = [
      createObject("fraction"),
      createObject("text"),
      createObject("sequence"),
      createObject("operation"),
    ];
    expect(
      parseDocument(JSON.parse(JSON.stringify(document)) as unknown),
    ).toEqual(document);
    expect(sequenceTerms({ start: 2, difference: 2, count: 5 })).toEqual([
      2, 4, 6, 8, 10,
    ]);
    expect(sequenceTerms({ start: 3, difference: -2, count: 4 })).toEqual([
      3, 1, -1, -3,
    ]);
  });
  it("rechaza esquemas futuros, identificadores repetidos y documentos excesivos", () => {
    const document = createDocument();
    expect(() => parseDocument({ ...document, schemaVersion: 2 })).toThrow();
    expect(() =>
      parseDocument({
        ...document,
        objects: [document.objects[0], document.objects[0]],
      }),
    ).toThrow();
    expect(() =>
      parseDocument({
        ...document,
        objects: Array.from({ length: MAX_OBJECTS + 1 }, () =>
          createObject("text"),
        ),
      }),
    ).toThrow();
  });
  it.each([
    { type: "fraction", data: { numerator: 1, denominator: 0, shape: "bar" } },
    { type: "fraction", data: { numerator: 4, denominator: 1, shape: "bar" } },
    {
      type: "fraction",
      data: { numerator: 1, denominator: 2, shape: ["bar"] },
    },
    {
      type: "operation",
      data: { expression: "alert(1)", stage: 0, shape: "bar" },
    },
    {
      type: "operation",
      data: { expression: "1/2 + 1/3", stage: 3, shape: "bar" },
    },
    { type: "sequence", data: { start: 1, difference: 1, count: 999999 } },
    { type: "text", data: { content: "hola", fontSize: 500 } },
    { type: "javascript", data: {} },
  ])("rechaza objetos matemáticos no admitidos: $type $data", (invalid) => {
    const document = createDocument("blank");
    expect(() =>
      parseDocument({
        ...document,
        objects: [{ ...createObject("text"), ...invalid }],
      }),
    ).toThrow();
  });
  it("mantiene los objetos completos dentro del lienzo", () => {
    const object = fitObject({
      ...createObject("fraction"),
      x: 9999,
      y: -10,
      width: 9999,
    });
    expect(object.x + object.width).toBeLessThanOrEqual(BOARD.width);
    expect(object.y).toBe(0);
    expect(() =>
      parseDocument({ ...createDocument("blank"), objects: [object] }),
    ).not.toThrow();
  });
});
