import { useRef, useState } from "react";
import { executeActions } from "../../core/agent/actions";
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
  const historyRef = useRef(history);
  function commit(next: History) {
    historyRef.current = next;
    setHistory(next);
  }
  const [materials, setMaterials] = useState(initial.materials);
  const [error, setError] = useState(initial.error);
  const [saved, setSaved] = useState(initial.recovered);
  function persist(document = historyRef.current.present): boolean {
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
      const current = historyRef.current;
      const next = parseDocument({
        ...change(structuredClone(current.present)),
        updatedAt: new Date().toISOString(),
      });
      commit({
        past: [...current.past.slice(-39), current.present],
        present: next,
        future: [],
      });
      persist(next);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "El cambio no es válido.");
      return false;
    }
  }
  function replace(document: StudioDocument): boolean {
    if (!persist()) return false;
    try {
      const next = parseDocument(document);
      if (!persist(next)) return false;
      commit({ past: [], present: next, future: [] });
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
    const current = historyRef.current;
    const previous = current.past.at(-1);
    if (!previous) return;
    commit({
      past: current.past.slice(0, -1),
      present: previous,
      future: [current.present, ...current.future],
    });
    persist(previous);
  }
  function redo() {
    const current = historyRef.current;
    const next = current.future[0];
    if (!next) return;
    commit({
      past: [...current.past, current.present],
      present: next,
      future: current.future.slice(1),
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
    execute: (batch: unknown, expected?: StudioDocument) => update(current => executeActions(current, batch, expected)),
    replace,
    open,
    remove,
    undo,
    redo,
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
