import { parseDocument, type StudioDocument } from "../../core/document-schema/document";

export type MaterialSummary = { id: string; title: string; updatedAt: string };
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
type Snapshot = { version: 2; activeId: string | null; documents: StudioDocument[] };
const key = (owner: string) => `fontex-studio-v2:${owner}`;
const legacyPrefix = (owner: string) => `fontex-studio-v1:${owner}:`;

function legacyMaterials(storage: StorageLike, owner: string): MaterialSummary[] {
  const entries: unknown = JSON.parse(storage.getItem(`${legacyPrefix(owner)}index`) ?? "[]");
  if (!Array.isArray(entries)) throw new Error("No se pudo leer la lista de materiales guardados.");
  return entries.filter((entry: unknown): entry is MaterialSummary => !!entry && typeof entry === "object"
    && "id" in entry && typeof entry.id === "string" && "title" in entry && typeof entry.title === "string"
    && "updatedAt" in entry && typeof entry.updatedAt === "string");
}

function readSnapshot(storage: StorageLike, owner: string, excludedId?: string): Snapshot {
  const raw = storage.getItem(key(owner));
  if (raw !== null) {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 2
      || !("documents" in parsed) || !Array.isArray(parsed.documents)
      || !("activeId" in parsed) || (parsed.activeId !== null && typeof parsed.activeId !== "string")) {
      throw new Error("No se pudo leer la lista de materiales guardados.");
    }
    const documents = parsed.documents.map(parseDocument);
    if (new Set(documents.map((document) => document.id)).size !== documents.length
      || (parsed.activeId !== null && !documents.some((document) => document.id === parsed.activeId))) {
      throw new Error("El almacén de materiales está incompleto.");
    }
    return { version: 2, activeId: parsed.activeId, documents };
  }
  // Read v1 without changing it. Migration commits in a single atomic setItem.
  const prefix = legacyPrefix(owner);
  const ids = legacyMaterials(storage, owner).map((entry) => entry.id);
  const storedActiveId = storage.getItem(`${prefix}active`);
  const activeId = storedActiveId === excludedId ? null : storedActiveId;
  if (activeId && !ids.includes(activeId)) ids.push(activeId);
  const documents = [...new Set(ids)].filter((id) => id !== excludedId).map((id) =>
    parseDocument(JSON.parse(storage.getItem(`${prefix}document:${id}`) ?? "null")));
  return { version: 2, activeId, documents };
}

function commit(storage: StorageLike, owner: string, snapshot: Snapshot) {
  const previousIds = storage.getItem(key(owner)) === null
    ? [...legacyMaterials(storage, owner).map((entry) => entry.id), storage.getItem(`${legacyPrefix(owner)}active`)]
    : readSnapshot(storage, owner).documents.map((document) => document.id);
  // localStorage replaces one key atomically; failure preserves the old snapshot.
  storage.setItem(key(owner), JSON.stringify(snapshot));
  // Cleanup is optional: the committed v2 snapshot always takes precedence.
  try {
    const prefix = legacyPrefix(owner);
    for (const id of previousIds) if (id) storage.removeItem(`${prefix}document:${id}`);
    storage.removeItem(`${prefix}index`);
    storage.removeItem(`${prefix}active`);
  } catch { /* A failed cleanup cannot invalidate a successful commit. */ }
}

export function listMaterials(storage: StorageLike, owner: string): MaterialSummary[] {
  if (storage.getItem(key(owner)) === null) return legacyMaterials(storage, owner);
  return readSnapshot(storage, owner).documents.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}
export function loadMaterial(storage: StorageLike, owner: string, id: string): StudioDocument {
  if (storage.getItem(key(owner)) === null) {
    return parseDocument(JSON.parse(storage.getItem(`${legacyPrefix(owner)}document:${id}`) ?? "null"));
  }
  const document = readSnapshot(storage, owner).documents.find((item) => item.id === id);
  if (!document) throw new Error("No se pudo abrir ese material.");
  return document;
}
export function lastMaterial(storage: StorageLike, owner: string): StudioDocument | null {
  if (storage.getItem(key(owner)) === null) {
    const active = storage.getItem(`${legacyPrefix(owner)}active`);
    return active ? loadMaterial(storage, owner, active) : null;
  }
  const snapshot = readSnapshot(storage, owner);
  return snapshot.documents.find((document) => document.id === snapshot.activeId) ?? null;
}
export function saveMaterial(storage: StorageLike, owner: string, document: StudioDocument) {
  const valid = parseDocument(document);
  const snapshot = readSnapshot(storage, owner);
  commit(storage, owner, { version: 2, activeId: valid.id,
    documents: [valid, ...snapshot.documents.filter((item) => item.id !== valid.id)] });
}
export function removeMaterial(storage: StorageLike, owner: string, id: string) {
  const snapshot = readSnapshot(storage, owner, id);
  commit(storage, owner, { ...snapshot,
    activeId: snapshot.activeId === id ? null : snapshot.activeId,
    documents: snapshot.documents.filter((item) => item.id !== id) });
}
