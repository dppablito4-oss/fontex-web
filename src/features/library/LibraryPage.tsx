import { Filter, FolderOpen, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "../auth/AuthProvider";
import { PageHeader } from "../shared/PageHeader";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { DocumentList } from "./components/DocumentList";
import { PdfViewer } from "./components/PdfViewer";
import { RagSearchPanel } from "./components/RagSearchPanel";
import { UploadDocument } from "./components/UploadDocument";
import { useDocuments } from "./hooks/useDocuments";
import { getDocumentScope, type DocumentScope } from "./types";

type ScopeFilter = "all" | DocumentScope;
type SortOrder = "newest" | "oldest" | "name";

export function LibraryPage() {
  const { status, user } = useAuth();
  const {
    activeClassroom,
    activeRole,
    members,
    groups,
    groupMemberships,
  } = useWorkspace();
  const library = useDocuments({
    classroomId: activeClassroom?.id ?? null,
    enabled: status === "authenticated",
  });
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const ownGroupIds = new Set(
    groupMemberships
      .filter((membership) => membership.userId === user?.id)
      .map((membership) => membership.groupId),
  );
  const shareableGroups = groups.filter((group) => ownGroupIds.has(group.id));
  const ownerNames = useMemo(
    () => new Map(members.map((member) => [member.userId, member.displayName])),
    [members],
  );

  const counts = useMemo(() => {
    const next = { all: library.documents.length, private: 0, group: 0, classroom: 0 };
    for (const document of library.documents) next[getDocumentScope(document)] += 1;
    return next;
  }, [library.documents]);

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    const filtered = library.documents.filter((document) => {
      const matchesQuery = !normalizedQuery
        || document.title.toLocaleLowerCase("es").includes(normalizedQuery)
        || document.originalFilename.toLocaleLowerCase("es").includes(normalizedQuery);
      return matchesQuery && (scopeFilter === "all" || getDocumentScope(document) === scopeFilter);
    });
    return [...filtered].sort((left, right) => {
      if (sortOrder === "name") return left.title.localeCompare(right.title, "es", { sensitivity: "base" });
      const difference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      return sortOrder === "oldest" ? difference : -difference;
    });
  }, [library.documents, query, scopeFilter, sortOrder]);

  const readyPages = library.documents
    .filter((document) => document.status === "ready")
    .reduce((total, document) => total + document.pageCount, 0);
  const ownedDocuments = library.documents.filter((document) => document.ownerId === user?.id);
  const ownedBytes = ownedDocuments.reduce((total, document) => total + document.sizeBytes, 0);

  if (status === "unconfigured") {
    return (
      <div className="page-wrap">
        <PageHeader
          eyebrow="Storage privado no configurado"
          title="Biblioteca"
          description="Configura las variables públicas de Supabase para acceder a documentos reales. Esta vista no inventa archivos ni contadores."
        />
        <Card className="mt-8 p-8 text-center">
          <FolderOpen className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Biblioteca no disponible en modo demostración</h2>
          <p className="mt-2 text-sm text-muted-foreground">Los PDF privados solo se muestran en una sesión autenticada y protegida por RLS.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow={`${library.documents.length} documentos autorizados · ${readyPages} páginas`}
        title="Biblioteca"
        description="Tus PDF permanecen privados hasta que compartes acceso explícitamente con un grupo o el aula."
        action={(
          <UploadDocument
            busy={library.pendingAction === "upload"}
            disabled={!activeClassroom || library.loading}
            groups={shareableGroups}
            limits={library.limits}
            teacher={activeRole === "teacher"}
            onUpload={library.upload}
          />
        )}
      />

      {!activeClassroom && (
        <p className="mt-6 rounded-xl border border-warning-border bg-warning-surface p-3 text-sm text-warning" role="status">
          No tienes un aula activa. Puedes consultar documentos propios anteriores, pero necesitas matrícula activa para subir o compartir.
        </p>
      )}
      {library.error && (
        <div className="mt-6 flex items-start justify-between gap-3 rounded-xl border border-error-border bg-error-surface p-3 text-sm text-error" role="alert">
          <span>{library.error}</span>
          <Button onClick={library.clearFeedback} size="sm" variant="ghost">Cerrar</Button>
        </div>
      )}
      {library.message && (
        <div className="mt-6 flex items-start justify-between gap-3 rounded-xl border border-success-border bg-success-surface p-3 text-sm text-success" role="status">
          <span>{library.message}</span>
          <Button onClick={library.clearFeedback} size="sm" variant="ghost">Cerrar</Button>
        </div>
      )}

      <Card className="mt-8 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="relative block flex-1 lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Buscar documentos por nombre</span>
            <input
              className="h-11 w-full rounded-full border border-control-border bg-surface pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Buscar por título o archivo…"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <span className="sr-only">Filtrar por alcance</span>
              <Filter className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <select className="h-10 rounded-full border border-control-border bg-surface pl-9 pr-4 text-xs font-semibold" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}>
                <option value="all">Todos los alcances</option>
                <option value="private">Privados</option>
                <option value="group">Grupos</option>
                <option value="classroom">Aula</option>
              </select>
            </label>
            <label className="relative">
              <span className="sr-only">Ordenar documentos</span>
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <select className="h-10 rounded-full border border-control-border bg-surface pl-9 pr-4 text-xs font-semibold" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="name">Nombre A–Z</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border bg-subtle px-5 py-3">
          <Badge tone={scopeFilter === "all" ? "green" : "neutral"}>Todos · {counts.all}</Badge>
          <Badge>Privados · {counts.private}</Badge>
          <Badge tone="blue">Grupo · {counts.group}</Badge>
          <Badge tone="green">Aula · {counts.classroom}</Badge>
          {library.limits && (
            <span className="ml-auto self-center text-xs text-muted-foreground">
              Uso propio: {ownedDocuments.length}/{library.limits.maxDocumentsPerUser} · {(ownedBytes / 1024 / 1024).toFixed(1)}/{(library.limits.maxBytesPerUser / 1024 / 1024).toFixed(0)} MiB
            </span>
          )}
        </div>

        {library.loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground" role="status">Cargando documentos autorizados…</p>
        ) : visibleDocuments.length ? (
          <DocumentList
            documents={visibleDocuments}
            groups={shareableGroups}
            ownerNames={ownerNames}
            pendingAction={library.pendingAction}
            teacher={activeRole === "teacher"}
            userId={user?.id ?? null}
            onDelete={library.remove}
            onDownload={library.download}
            onOpen={library.open}
            onProcess={library.process}
            onRevoke={library.revoke}
            onShare={library.share}
          />
        ) : (
          <div className="p-10 text-center">
            <FolderOpen className="mx-auto size-9 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">
              {library.documents.length ? "No hay documentos que coincidan" : "Todavía no tienes documentos"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {library.documents.length ? "Prueba otro nombre o alcance." : "Añade tu primer PDF para comenzar."}
            </p>
          </div>
        )}
      </Card>

      <RagSearchPanel />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        PDF.js valida en el navegador y extrae en el servidor. Los fragmentos indexados alimentan directamente las consultas fundamentadas del Tutor Académico.
      </p>

      {library.viewer && (
        <PdfViewer
          blob={library.viewer.blob}
          document={library.viewer.document}
          onClose={library.closeViewer}
        />
      )}
    </div>
  );
}
