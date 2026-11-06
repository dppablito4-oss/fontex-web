import { CheckSquare, ExternalLink, FileText, Square } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { getDocumentScope, type DocumentScope, type LibraryDocument } from "../../library/types";
import type { TutorCitation } from "../types";

export function SourceSelectorPanel({
  documents,
  selectedIds,
  onSelectIds,
  citations = [],
  onOpenCitation,
}: {
  documents: LibraryDocument[];
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  citations?: TutorCitation[];
  onOpenCitation: (citation: TutorCitation) => void;
}) {
  const [scopeFilter, setScopeFilter] = useState<"all" | DocumentScope>("all");

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (scopeFilter === "all") return true;
      return getDocumentScope(doc) === scopeFilter;
    });
  }, [documents, scopeFilter]);

  const indexedDocs = useMemo(() => {
    return filteredDocs.filter((d) => d.status === "ready");
  }, [filteredDocs]);

  const toggleDoc = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectIds(selectedIds.filter((item) => item !== id));
    } else {
      onSelectIds([...selectedIds, id]);
    }
  };

  const selectAllIndexed = () => {
    const readyIds = indexedDocs.map((d) => d.id);
    onSelectIds(Array.from(new Set([...selectedIds, ...readyIds])));
  };

  const clearSelection = () => {
    onSelectIds([]);
  };

  // Check for any selected IDs that no longer exist in available documents
  const missingSelectedCount = useMemo(() => {
    const existingSet = new Set(documents.map((d) => d.id));
    return selectedIds.filter((id) => !existingSet.has(id)).length;
  }, [documents, selectedIds]);

  return (
    <div className="flex h-full flex-col text-sm">
      {/* Header */}
      <div className="border-b border-border p-4">
        <p className="text-xs text-muted-foreground">{selectedIds.length === 0 ? "Se consultan todos los archivos disponibles." : `${selectedIds.length} seleccionada${selectedIds.length === 1 ? "" : "s"}`}</p>
        {documents.length > 0 && (
          <label className="mt-3 grid gap-1.5 text-xs font-semibold">Mostrar
            <select className="rounded-lg border border-border bg-surface px-2.5 py-2 text-sm" onChange={(event) => setScopeFilter(event.target.value as "all" | DocumentScope)} value={scopeFilter}>
              <option value="all">Todos los archivos</option>
              <option value="classroom">Aula</option>
              <option value="group">Grupo</option>
              <option value="private">Privados</option>
            </select>
          </label>
        )}

        {/* Batch selection buttons */}
        {documents.length > 0 && <div className="mt-2 flex items-center justify-between text-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectAllIndexed}
            disabled={indexedDocs.length === 0}
            className="h-7 px-2 text-[11px] text-primary"
          >
            Seleccionar archivos listos
          </Button>
          {selectedIds.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Quitar selección
            </Button>
          )}
        </div>}

        {missingSelectedCount > 0 && (
          <div className="mt-2 rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-500 dark:text-amber-400">
            {missingSelectedCount} de los archivos seleccionados ya no están disponibles.
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredDocs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Aquí aparecerán las lecturas que puedes consultar con el tutor.
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isSelected = selectedIds.includes(doc.id);
            const isIndexed = doc.status === "ready";
            const scope = getDocumentScope(doc);

            return (
              <button
                aria-pressed={isSelected}
                key={doc.id}
                onClick={() => toggleDoc(doc.id)}
                type="button"
                className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                  isSelected
                    ? "border-primary/50 bg-primary/5 dark:bg-primary/10"
                    : "border-border bg-surface hover:border-border-hover hover:bg-subtle"
                }`}
              >
                <div className="mt-0.5 shrink-0 text-primary">
                  {isSelected ? (
                    <CheckSquare className="size-4" />
                  ) : (
                    <Square className="size-4 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate text-xs font-medium text-foreground">
                      {doc.title}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-muted-foreground">
                      {doc.pageCount} pág{doc.pageCount === 1 ? "" : "s"}
                    </span>
                    <span>•</span>
                    <span className="capitalize text-muted-foreground">
                      {scope === "classroom" ? "Aula" : scope === "group" ? "Grupo" : "Privado"}
                    </span>

                    {/* Status Badge */}
                    {isIndexed ? (
                      <span className="inline-flex items-center rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                        Listo
                      </span>
                    ) : (doc.processing?.status === "processing" || doc.status === "uploading") ? (
                      <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                        Preparando…
                      </span>
                    ) : doc.status === "failed" ? (
                      <span className="inline-flex items-center rounded bg-rose-500/10 px-1.5 py-0.5 font-medium text-rose-600 dark:text-rose-400">
                        No disponible
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded bg-stone-500/10 px-1.5 py-0.5 font-medium text-stone-500">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Citations in active conversation */}
      {citations.length > 0 && (
        <div className="border-t border-border p-3 max-h-48 overflow-y-auto bg-subtle/50">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Referencias citadas ({citations.length})
          </p>
          <div className="space-y-1.5">
            {citations.map((c, idx) => (
              <div
                key={`${c.documentId}-${c.chunkId}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="truncate font-medium text-foreground text-[11px]">
                    {c.documentTitle}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Pág. {c.pageStart}
                    {c.pageEnd > c.pageStart ? `-${c.pageEnd}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCitation(c)}
                  className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  Abrir <ExternalLink className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
