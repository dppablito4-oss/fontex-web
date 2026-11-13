import { expect, it } from "vitest";
import { createDocument } from "../../core/object-registry/registry";
import { clearRetiredMaterials } from "../general-canvas/scene-storage";
import { canvasCacheKey, lastMaterial, listMaterials, loadMaterial, saveMaterial } from "./native-document-store";

it("starts without restoring retired materials and preserves new materials through cleanup", () => {
  const old = createDocument();
  localStorage.setItem("fontex-studio-v2:guest", JSON.stringify({ version: 2, activeId: old.id, documents: [old] }));
  expect(lastMaterial(localStorage, "guest")).toBeNull();
  const next = createDocument("sequences");
  saveMaterial(localStorage, "guest", next);
  clearRetiredMaterials(localStorage);
  expect(localStorage.getItem("fontex-studio-v2:guest")).toBeNull();
  expect(lastMaterial(localStorage, "guest")).toEqual(next);
  expect(localStorage.getItem(canvasCacheKey("guest"))).not.toBeNull();
});

it("keeps native materials isolated by owner and atomically preserves them on failed writes", () => {
  const doc = createDocument();
  saveMaterial(localStorage, "one", doc);
  expect(listMaterials(localStorage, "two")).toEqual([]);
  const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: () => { throw Error("QuotaExceeded"); }, removeItem: () => {} };
  expect(() => saveMaterial(storage, "one", createDocument())).toThrow();
  expect(loadMaterial(localStorage, "one", doc.id)).toEqual(doc);
});
