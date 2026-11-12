import { useState } from "react";
import {
  parseDocument,
  type StudioDocument,
} from "../../core/document-schema/document";
import { createDocument } from "../../core/object-registry/registry";
import {
  lastMaterial,
  listMaterials,
  loadMaterial,
  removeMaterial,
  saveMaterial,
  type MaterialSummary,
} from "./document-store";

type History = {
  past: StudioDocument[];
  present: StudioDocument;
  future: StudioDocument[];
};
function initialState(owner: string) {
  try {
    const recovered = lastMaterial(localStorage, owner);
    return {
      document: recovered ?? createDocument(),
      materials: listMaterials(localStorage, owner),
      error: "",
      recovered: !!recovered,
    };
  } catch {
    return {
      document: createDocument(),
      materials: [] as MaterialSummary[],
      error:
        "No se pudo recuperar el material anterior. Importa una copia para abrirlo.",
      recovered: false,
    };
  }
}

export function useStudioDocument(owner: string) {
  const [initial] = useState(() => initialState(owner));
  const [history, setHistory] = useState<History>({
    past: [],
    present: initial.document,
    future: [],
  });
  const [materials, setMaterials] = useState(initial.materials);
  const [error, setError] = useState(initial.error);
  const [saved, setSaved] = useState(initial.recovered);
  function persist(document = history.present): boolean {
    try {
      saveMaterial(localStorage, owner, document);
      setMaterials(listMaterials(localStorage, owner));
      setSaved(true);
      setError("");
      return true;
    } catch {
      setSaved(false);
      setError(
        "No se pudo guardar. Exporta una copia antes de cerrar.",
      );
      return false;
    }
  }
  function update(change: (document: StudioDocument) => StudioDocument) {
    try {
      const next = parseDocument({
        ...change(history.present),
        updatedAt: new Date().toISOString(),
      });
      setHistory({
        past: [...history.past.slice(-39), history.present],
        present: next,
        future: [],
      });
      persist(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "El cambio no es válido.");
    }
  }
  function replace(document: StudioDocument): boolean {
    if (!persist()) return false;
    try {
      const next = parseDocument(document);
      if (!persist(next)) return false;
      setHistory({ past: [], present: next, future: [] });
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo abrir el material.",
      );
      return false;
    }
  }
  function open(id: string): boolean {
    try {
      return replace(loadMaterial(localStorage, owner, id));
    } catch {
      setError(
        "No se pudo abrir ese material. El documento actual sigue disponible.",
      );
      return false;
    }
  }
  function remove(id: string) {
    try {
      removeMaterial(localStorage, owner, id);
      setMaterials(listMaterials(localStorage, owner));
    } catch {
      setError("No se pudo eliminar el material guardado.");
    }
  }
  function undo() {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory({
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future],
    });
    persist(previous);
  }
  function redo() {
    const next = history.future[0];
    if (!next) return;
    setHistory({
      past: [...history.past, history.present],
      present: next,
      future: history.future.slice(1),
    });
    persist(next);
  }
  return {
    document: history.present,
    materials,
    error,
    saved,
    persist,
    update,
    replace,
    open,
    remove,
    undo,
    redo,
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
