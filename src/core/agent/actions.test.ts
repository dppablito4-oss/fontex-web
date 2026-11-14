import { describe, expect, it } from "vitest";
import { createDocument, createObject } from "../object-registry/registry";
import { executeActions, parseBatch, readStudioContext } from "./actions";

describe("Ejecutor transaccional de Studio", () => {
  it("crea, modifica y elimina sin mutar el documento de entrada", () => {
    const doc = createDocument();
    const original = structuredClone(doc);
    const object = createObject("fraction");
    const next = executeActions(doc, {
      documentId: doc.id,
      actions: [
        { kind: "create", object },
        {
          kind: "update",
          object: {
            ...object,
            data: { numerator: 1, denominator: 2, shape: "circle" },
          },
        },
        { kind: "delete", id: doc.objects[0]!.id },
      ],
    });
    expect(doc).toEqual(original);
    expect(next.objects).toHaveLength(2);
    expect(next.objects.at(-1)?.data).toEqual({
      numerator: 1,
      denominator: 2,
      shape: "circle",
    });
  });
  it("no aplica parcialmente un lote que falla al final", () => {
    const doc = createDocument("blank");
    expect(() =>
      executeActions(doc, {
        documentId: doc.id,
        actions: [
          { kind: "create", object: createObject("text") },
          { kind: "delete", id: "missing" },
        ],
      })
    ).toThrow(/ya no existe/);
    expect(doc.objects).toEqual([]);
  });
  it.each(
    [
      "fraction",
      "operation",
      "text",
      "sequence",
      "collection",
      "number-line",
      "linear-equation",
      "function-graph",
    ] as const,
  )("admite el tipo registrado %s", (type) => {
    const doc = createDocument("blank");
    expect(
      executeActions(doc, {
        documentId: doc.id,
        actions: [{ kind: "create", object: createObject(type) }],
      }).objects[0]?.type,
    ).toBe(type);
  });
  it("rechaza tipos, campos o código fuera de la lista de acciones", () => {
    expect(() =>
      parseBatch({
        documentId: "doc",
        actions: [{ kind: "eval", code: "alert(1)" }],
      })
    ).toThrow(/no permitida/);
    expect(() =>
      parseBatch({
        documentId: "doc",
        actions: [{
          kind: "create",
          object: { ...createObject("text"), onclick: "alert(1)" },
        }],
      })
    ).toThrow(/esquema/);
    expect(() =>
      parseBatch({
        documentId: "doc",
        actions: [{
          kind: "create",
          object: {
            ...createObject("text"),
            data: { content: "ok", fontSize: 22, code: "exec" },
          },
        }],
      })
    ).toThrow(/esquema/);
  });
  it("rechaza fracciones y geometría inválidas", () => {
    const fraction = createObject("fraction");
    for (
      const object of [{ ...fraction, x: -1 }, {
        ...fraction,
        data: { numerator: 2, denominator: 0, shape: "bar" },
      }]
    ) {
      expect(() =>
        parseBatch({ documentId: "doc", actions: [{ kind: "create", object }] })
      ).toThrow(/esquema/);
    }
  });
  it("rechaza duplicados, cambios de tipo y lotes excesivos", () => {
    const doc = createDocument();
    const object = doc.objects[0]!;
    expect(() =>
      executeActions(doc, {
        documentId: doc.id,
        actions: [{ kind: "create", object }],
      })
    ).toThrow(/Ya existe/);
    expect(() =>
      executeActions(doc, {
        documentId: doc.id,
        actions: [{
          kind: "update",
          object: { ...createObject("text"), id: object.id },
        }],
      })
    ).toThrow(/tipo/);
    expect(() =>
      parseBatch({
        documentId: doc.id,
        actions: Array(21).fill({ kind: "delete", id: object.id }),
      })
    ).toThrow(/20/);
    const full = {
      ...doc,
      objects: Array.from({ length: 80 }, () => createObject("fraction")),
    };
    expect(() =>
      executeActions(full, {
        documentId: doc.id,
        actions: [{ kind: "create", object: createObject("text") }],
      })
    ).toThrow(/documento válido/);
  });
  it("rechaza otro material y una propuesta obsoleta aunque la fecha coincida", () => {
    const doc = createDocument();
    const batch = {
      documentId: doc.id,
      actions: [{ kind: "delete", id: doc.objects[0]!.id }],
    };
    expect(() => executeActions({ ...doc, title: "Editado" }, batch, doc))
      .toThrow(/cambió/);
    expect(() => executeActions(doc, { ...batch, documentId: "other" }))
      .toThrow(/cambió/);
  });
  it("lee contexto aislado con resultados calculados por MathEngine", () => {
    const doc = createDocument();
    doc.objects.push(createObject("sequence"));
    const context = readStudioContext(doc, doc.objects[0]!.id);
    expect(context.selectedId).toBe(doc.objects[0]!.id);
    expect(context.mathematics[0]).toMatchObject({
      operation: { simplified: { n: 7, d: 6 } },
    });
    expect(context.mathematics.at(-1)).toMatchObject({
      terms: [2, 4, 6, 8, 10],
    });
    context.document.objects[0]!.label = "Cambio externo";
    expect(doc.objects[0]!.label).not.toBe("Cambio externo");
    expect(readStudioContext(doc, "missing").selectedId).toBeNull();
  });
  it("protege las colecciones anidadas de mutaciones externas", () => {
    const doc = createDocument("blank");
    const object = createObject("collection");
    const batch = { documentId: doc.id, actions: [{ kind: "create", object }] };
    const parsed = parseBatch(batch);
    if (object.type === "collection") object.data.values[0] = 999;
    const next = executeActions(doc, parsed);
    expect(next.objects[0]?.data).toEqual({ values: [2, 4, 6, 8] });
  });
});
