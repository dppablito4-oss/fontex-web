import { parseDocument, type StudioDocument } from "../../core/document-schema/document";
import type { MaterialSummary, StorageLike } from "./document-store";

type Snapshot = { version: 1; activeId: string | null; documents: StudioDocument[] };
export const canvasCacheKey = (owner: string) => `fontex-canvas-v1:${owner}`;

function read(storage: StorageLike, owner: string): Snapshot {
  const raw = storage.getItem(canvasCacheKey(owner));
  if (raw === null) return { version: 1, activeId: null, documents: [] };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
    !("documents" in value) || !Array.isArray(value.documents) || !("activeId" in value)) throw new Error("No se pudo leer el lienzo guardado.");
  const documents = value.documents.map(parseDocument);
  if (new Set(documents.map(doc => doc.id)).size !== documents.length ||
    (value.activeId !== null && !documents.some(doc => doc.id === value.activeId))) throw new Error("El almacén del lienzo está incompleto.");
  return { version: 1, activeId: value.activeId as string | null, documents };
}
function commit(storage: StorageLike, owner: string, snapshot: Snapshot): void {
  storage.setItem(canvasCacheKey(owner), JSON.stringify(snapshot));
  if (storage === window.localStorage) window.dispatchEvent(new CustomEvent("fontex-canvas-change", { detail: owner }));
}
export function listMaterials(storage: StorageLike, owner: string): MaterialSummary[] {
  return read(storage, owner).documents.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}
export function loadMaterial(storage: StorageLike, owner: string, id: string): StudioDocument {
  const document = read(storage, owner).documents.find(doc => doc.id === id);
  if (!document) throw new Error("No se pudo abrir ese material.");
  return document;
}
export function lastMaterial(storage: StorageLike, owner: string): StudioDocument | null {
  const snapshot = read(storage, owner);
  return snapshot.documents.find(doc => doc.id === snapshot.activeId) ?? null;
}
export function saveMaterial(storage: StorageLike, owner: string, document: StudioDocument): void {
  const valid = parseDocument(document), snapshot = read(storage, owner);
  commit(storage, owner, { version: 1, activeId: valid.id, documents: [valid, ...snapshot.documents.filter(doc => doc.id !== valid.id)] });
}
export function removeMaterial(storage: StorageLike, owner: string, id: string): void {
  const snapshot = read(storage, owner);
  commit(storage, owner, { ...snapshot, activeId: snapshot.activeId === id ? null : snapshot.activeId, documents: snapshot.documents.filter(doc => doc.id !== id) });
}
