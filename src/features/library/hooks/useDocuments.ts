import { useCallback, useEffect, useState } from "react";

import {
  deleteDocument,
  downloadDocument,
  getDocumentLimits,
  listDocuments,
  revokeDocumentShare,
  shareDocument,
  uploadDocument,
} from "../services/documentService";
import type {
  DocumentLimits,
  LibraryDocument,
  PreparedPdf,
  UploadScope,
} from "../types";

export function useDocuments({
  classroomId,
  enabled,
}: {
  classroomId: string | null;
  enabled: boolean;
}) {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [limits, setLimits] = useState<DocumentLimits | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ document: LibraryDocument; blob: Blob } | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setDocuments([]);
      setLimits(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextDocuments, nextLimits] = await Promise.all([
        listDocuments(classroomId),
        getDocumentLimits(),
      ]);
      setDocuments(nextDocuments);
      setLimits(nextLimits);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "No fue posible cargar la biblioteca.");
    } finally {
      setLoading(false);
    }
  }, [classroomId, enabled]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const runAction = useCallback(async <T,>(key: string, action: () => Promise<T>) => {
    setPendingAction(key);
    setError(null);
    setMessage(null);
    try {
      return await action();
    } catch (actionError) {
      const text = actionError instanceof Error ? actionError.message : "No fue posible completar la acción.";
      setError(text);
      throw actionError;
    } finally {
      setPendingAction(null);
    }
  }, []);

  const upload = useCallback(async (prepared: PreparedPdf, scope: UploadScope) => {
    if (!classroomId) throw new Error("Selecciona un aula activa antes de subir documentos.");
    await runAction("upload", async () => {
      const documentId = await uploadDocument(classroomId, prepared);
      if (scope.type !== "private") {
        try {
          await shareDocument({ id: documentId, classroomId }, scope);
        } catch (shareError) {
          await refresh();
          const detail = shareError instanceof Error ? shareError.message : "No fue posible compartirlo.";
          throw new Error(`El PDF quedó cargado como privado. ${detail}`, { cause: shareError });
        }
      }
      await refresh();
      setMessage(scope.type === "private" ? "PDF cargado de forma privada." : "PDF cargado y compartido.");
    });
  }, [classroomId, refresh, runAction]);

  const open = useCallback(async (document: LibraryDocument) => {
    await runAction(`open:${document.id}`, async () => {
      const blob = await downloadDocument(document);
      setViewer({ document, blob });
    });
  }, [runAction]);

  const download = useCallback(async (document: LibraryDocument) => {
    await runAction(`download:${document.id}`, async () => {
      const blob = await downloadDocument(document);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.originalFilename;
      anchor.rel = "noopener";
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage("Descarga autorizada iniciada.");
    });
  }, [runAction]);

  const remove = useCallback(async (document: LibraryDocument) => {
    await runAction(`delete:${document.id}`, async () => {
      await deleteDocument(document.id);
      if (viewer?.document.id === document.id) setViewer(null);
      await refresh();
      setMessage("Documento y permisos eliminados.");
    });
  }, [refresh, runAction, viewer?.document.id]);

  const share = useCallback(async (
    document: LibraryDocument,
    scope: Exclude<UploadScope, { type: "private" }>,
  ) => {
    await runAction(`share:${document.id}`, async () => {
      await shareDocument(document, scope);
      await refresh();
      setMessage("Acceso compartido correctamente.");
    });
  }, [refresh, runAction]);

  const revoke = useCallback(async (shareId: string, documentId: string) => {
    await runAction(`share:${documentId}`, async () => {
      await revokeDocumentShare(shareId);
      await refresh();
      setMessage("La compartición fue revocada.");
    });
  }, [refresh, runAction]);

  return {
    documents,
    limits,
    loading,
    pendingAction,
    error,
    message,
    viewer,
    upload,
    open,
    download,
    remove,
    share,
    revoke,
    closeViewer: () => setViewer(null),
    clearFeedback: () => {
      setError(null);
      setMessage(null);
    },
    refresh,
  };
}
