import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDocument } from "../../core/object-registry/registry";
import { lastMaterial, saveMaterial } from "./document-store";
import { useStudioDocument } from "./useStudioDocument";

describe("Cambio de material con almacenamiento limitado", () => {
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
