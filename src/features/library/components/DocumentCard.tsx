import { DatabaseZap, Download, Eye, FileText, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import type { StudyGroup } from "../../workspace/WorkspaceProvider";
import { getDocumentScope, type LibraryDocument, type UploadScope } from "../types";
import { ShareDocument } from "./ShareDocument";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MiB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

const scopeLabels = {
  private: { label: "Privado", tone: "neutral" as const },
  group: { label: "Grupo", tone: "blue" as const },
  classroom: { label: "Aula", tone: "green" as const },
};

export function DocumentCard({
  document,
  owner,
  ownerName,
  groups,
  teacher,
  pendingAction,
  onOpen,
  onDownload,
  onDelete,
  onShare,
  onRevoke,
  onProcess,
}: {
  document: LibraryDocument;
  owner: boolean;
  ownerName: string;
  groups: StudyGroup[];
  teacher: boolean;
  pendingAction: string | null;
  onOpen: () => Promise<void>;
  onDownload: () => Promise<void>;
  onDelete: () => Promise<void>;
  onShare: (scope: Exclude<UploadScope, { type: "private" }>) => Promise<void>;
  onRevoke: (shareId: string) => Promise<void>;
  onProcess: () => Promise<void>;
}) {
  const scope = getDocumentScope(document);
  const scopeBadge = scopeLabels[scope];
  const ready = document.status === "ready";
  const busy = pendingAction?.endsWith(document.id) ?? false;

  return (
    <article className="flex flex-col gap-4 border-b border-border p-4 last:border-b-0 sm:flex-row sm:items-center sm:px-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-info-surface text-info-foreground">
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{document.title}</h3>
          {ready ? (
            <Badge tone={scopeBadge.tone}>{scopeBadge.label}</Badge>
          ) : (
            <Badge tone={document.status === "failed" ? "orange" : "blue"}>
              {document.status === "failed" ? "Carga fallida" : "Procesando"}
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {owner ? "Tuyo" : ownerName} · {formatDate(document.createdAt)} · {formatBytes(document.sizeBytes)} · {document.pageCount} páginas
        </p>
        {ready && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {document.processing?.status === "ready" ? (
              <Badge tone="green">Índice listo · {document.processing.chunkCount} fragmentos</Badge>
            ) : document.processing?.status === "failed" ? (
              <Badge tone="orange">Índice fallido</Badge>
            ) : document.processing ? (
              <Badge tone="blue">
                Indexando · {document.processing.embeddedChunkCount}/{document.processing.chunkCount || "…"}
              </Badge>
            ) : (
              <Badge>Sin indexar</Badge>
            )}
            {owner && document.processing?.status === "failed" && document.processing.failureDetail && (
              <span>{document.processing.failureDetail}</span>
            )}
          </div>
        )}
        {document.status === "failed" && (
          <p className="mt-1 text-xs text-warning">El archivo no quedó disponible. Elimina este registro y vuelve a intentarlo.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {ready && (
          <>
            <Button disabled={busy} onClick={() => void onOpen()} size="sm" variant="secondary">
              {pendingAction === `open:${document.id}` ? <LoaderCircle className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />} Abrir
            </Button>
            <Button disabled={busy} onClick={() => void onDownload()} size="sm" variant="secondary">
              {pendingAction === `download:${document.id}` ? <LoaderCircle className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Descargar
            </Button>
          </>
        )}
        {owner && ready && (
          <ShareDocument
            busy={busy}
            document={document}
            groups={groups}
            teacher={teacher}
            onShare={onShare}
            onRevoke={onRevoke}
          />
        )}
        {owner && ready && document.processing?.status !== "ready" && (
          <Button disabled={busy} onClick={() => void onProcess()} size="sm" variant="secondary">
            {pendingAction === `index:${document.id}` ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : document.processing?.status === "failed" ? (
              <RefreshCw className="size-3.5" />
            ) : (
              <DatabaseZap className="size-3.5" />
            )}
            {document.processing?.status === "failed" ? "Reintentar índice" : "Indexar"}
          </Button>
        )}
        {owner && (
          <Button
            aria-label={`Eliminar ${document.title}`}
            disabled={busy}
            onClick={() => {
              if (window.confirm(`¿Eliminar “${document.title}” y revocar todos sus accesos?`)) void onDelete();
            }}
            size="icon"
            variant="ghost"
          >
            {pendingAction === `delete:${document.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        )}
      </div>
    </article>
  );
}
