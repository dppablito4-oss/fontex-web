import {
  parseDocument,
  type StudioDocument,
} from "../../core/document-schema/document";

export type MaterialSummary = { id: string; title: string; updatedAt: string };
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const prefix = (owner: string) => `fontex-studio-v1:${owner}:`;
const key = (owner: string, id: string) => `${prefix(owner)}document:${id}`;

export function listMaterials(
  storage: StorageLike,
  owner: string,
): MaterialSummary[] {
  const parsed: unknown = JSON.parse(
    storage.getItem(`${prefix(owner)}index`) || "[]",
  );
  if (!Array.isArray(parsed))
    throw new Error("No se pudo leer la lista de materiales guardados.");
  return parsed.filter(
    (item: unknown): item is MaterialSummary =>
      !!item &&
      typeof item === "object" &&
      "id" in item &&
      typeof item.id === "string" &&
      "title" in item &&
      typeof item.title === "string" &&
      "updatedAt" in item &&
      typeof item.updatedAt === "string",
  );
}
export function loadMaterial(
  storage: StorageLike,
  owner: string,
  id: string,
): StudioDocument {
  return parseDocument(JSON.parse(storage.getItem(key(owner, id)) || "null"));
}
export function lastMaterial(
  storage: StorageLike,
  owner: string,
): StudioDocument | null {
  const id = storage.getItem(`${prefix(owner)}active`);
  return id ? loadMaterial(storage, owner, id) : null;
}
export function saveMaterial(
  storage: StorageLike,
  owner: string,
  document: StudioDocument,
) {
  const valid = parseDocument(document);
  const entries = listMaterials(storage, owner).filter(
    (item) => item.id !== valid.id,
  );
  storage.setItem(key(owner, valid.id), JSON.stringify(valid));
  storage.setItem(
    `${prefix(owner)}index`,
    JSON.stringify([
      { id: valid.id, title: valid.title, updatedAt: valid.updatedAt },
      ...entries,
    ]),
  );
  storage.setItem(`${prefix(owner)}active`, valid.id);
}
export function removeMaterial(
  storage: StorageLike,
  owner: string,
  id: string,
) {
  const entries = listMaterials(storage, owner).filter(
    (item) => item.id !== id,
  );
  storage.setItem(`${prefix(owner)}index`, JSON.stringify(entries));
  storage.removeItem(key(owner, id));
  if (storage.getItem(`${prefix(owner)}active`) === id)
    storage.removeItem(`${prefix(owner)}active`);
}
