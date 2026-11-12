import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDocument, createObject } from "../../core/object-registry/registry";
import { lastMaterial, saveMaterial } from "./document-store";
import { useStudioDocument } from "./useStudioDocument";

describe("Cambio de material con almacenamiento limitado", () => {
  it("guarda un lote como un único paso de deshacer y rehacer", () => {
    const { result } = renderHook(() => useStudioDocument("guest"));
    const original = structuredClone(result.current.document);
    const batch = { documentId: original.id, actions: [
      { kind: "create", object: createObject("fraction") },
      { kind: "delete", id: original.objects[0]!.id },
    ] };
    act(() => { expect(result.current.execute(batch, original)).toBe(true); });
    const applied = result.current.document;
    expect(lastMaterial(localStorage, "guest")).toEqual(applied);
    act(() => result.current.undo());
    expect(result.current.document).toEqual(original);
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.redo());
    expect(result.current.document).toEqual(applied);
  });
  it("rechaza propuestas obsoletas y cambios inválidos sin crear historial", () => {
    const { result } = renderHook(() => useStudioDocument("guest"));
    const original = structuredClone(result.current.document);
    const batch = { documentId: original.id, actions: [{ kind: "delete", id: original.objects[0]!.id }] };
    act(() => {
      result.current.update(doc => ({ ...doc, title: "Editado" }));
      expect(result.current.execute(batch, original)).toBe(false);
    });
    expect(result.current.document.title).toBe("Editado");
    expect(result.current.document.objects).toEqual(original.objects);
    act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
  });
  it("conserva el material actual y devuelve fallo si no puede guardar el nuevo", () => {
    const original = createDocument();
    const next = createDocument("sequences");
    saveMaterial(localStorage, "guest", original);
    const { result } = renderHook(() => useStudioDocument("guest"));
    const setItem = localStorage.setItem.bind(localStorage);
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (value.includes(next.id)) throw new Error("QuotaExceeded");
      setItem(key, value);
    });
    try {
      act(() => { expect(result.current.replace(next)).toBe(false); });
      expect(result.current.document).toEqual(original);
      expect(result.current.error).toMatch(/No se pudo guardar/);
      expect(lastMaterial(localStorage, "guest")).toEqual(original);
    } finally { write.mockRestore(); }
  });
});
