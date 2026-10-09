import { useCallback, useEffect, useMemo, useState } from "react";

import { downloadDocument } from "../../library/services/documentService";
import type { LibraryDocument } from "../../library/types";
import {
  checkTutorHealth,
  createConversation,
  deleteConversation as deleteConversationApi,
  invokeTutorChat,
  listConversations,
  listMessages,
  updateConversation,
} from "../services/tutorService";
import type {
  TutorCitation,
  TutorConversation,
  TutorHealthStatus,
  TutorMessageRecord,
  TutorMode,
} from "../types";

export function useTutor({
  classroomId,
  documents = [],
}: {
  classroomId: string | null;
  documents?: LibraryDocument[];
}) {
  const [conversations, setConversations] = useState<TutorConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TutorMessageRecord[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<TutorHealthStatus>({
    configured: false,
    available: false,
    model: "Verificando...",
  });

  const [localMode, setLocalMode] = useState<TutorMode | null>(null);
  const [localGuided, setLocalGuided] = useState<boolean | null>(null);
  const [localSelectedDocIds, setLocalSelectedDocIds] = useState<string[] | null>(null);

  const [viewer, setViewer] = useState<{
    document: LibraryDocument;
    page: number;
    blob: Blob;
  } | null>(null);

  // Check health on load
  useEffect(() => {
    let active = true;
    void checkTutorHealth().then((status) => {
      if (active) setHealth(status);
    });
    return () => {
      active = false;
    };
  }, []);

  // Refresh conversations when classroom changes
  const refreshConversations = useCallback(async () => {
    if (!classroomId) {
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    setLoadingConversations(true);
    setError(null);
    try {
      const list = await listConversations(classroomId);
      setConversations(list);
      if (list.length > 0) {
        setActiveConversationId((prev) =>
          prev && list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? null),
        );
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar conversaciones.");
    } finally {
      setLoadingConversations(false);
    }
  }, [classroomId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshConversations(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshConversations]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;

  const mode: TutorMode = localMode ?? activeConversation?.mode ?? "strict";
  const guided: boolean = localGuided ?? activeConversation?.guided ?? false;
  const selectedDocumentIds: string[] = useMemo(() => {
    return localSelectedDocIds ?? activeConversation?.selectedDocumentIds ?? [];
  }, [activeConversation?.selectedDocumentIds, localSelectedDocIds]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      const resetTimer = window.setTimeout(() => setMessages([]), 0);
      return () => window.clearTimeout(resetTimer);
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setLoadingMessages(true);
      setError(null);

      void listMessages(activeConversationId)
        .then((msgs) => {
          if (!active) return;
          setMessages(msgs);
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : "Error al cargar mensajes.");
        })
        .finally(() => {
          if (active) setLoadingMessages(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeConversationId]);

  // Mode change
  const setMode = useCallback(
    async (nextMode: TutorMode) => {
      setLocalMode(nextMode);
      if (activeConversationId) {
        try {
          await updateConversation(activeConversationId, { mode: nextMode });
          setConversations((prev) =>
            prev.map((c) => (c.id === activeConversationId ? { ...c, mode: nextMode } : c)),
          );
        } catch (err) {
          console.error("Failed to persist mode:", err);
        }
      }
    },
    [activeConversationId],
  );

  // Guided change
  const setGuided = useCallback(
    async (nextGuided: boolean) => {
      setLocalGuided(nextGuided);
      if (activeConversationId) {
        try {
          await updateConversation(activeConversationId, { guided: nextGuided });
          setConversations((prev) =>
            prev.map((c) => (c.id === activeConversationId ? { ...c, guided: nextGuided } : c)),
          );
        } catch (err) {
          console.error("Failed to persist guided:", err);
        }
      }
    },
    [activeConversationId],
  );

  // Selected document IDs change
  const setSelectedDocumentIds = useCallback(
    async (ids: string[]) => {
      setLocalSelectedDocIds(ids);
      if (activeConversationId) {
        try {
          await updateConversation(activeConversationId, { selectedDocumentIds: ids });
          setConversations((prev) =>
            prev.map((c) => (c.id === activeConversationId ? { ...c, selectedDocumentIds: ids } : c)),
          );
        } catch (err) {
          console.error("Failed to persist selected docs:", err);
        }
      }
    },
    [activeConversationId],
  );

  // Select a conversation
  const selectConversation = useCallback((id: string) => {
    setLocalMode(null);
    setLocalGuided(null);
    setLocalSelectedDocIds(null);
    setActiveConversationId(id);
  }, []);

  // Start new conversation
  const startNewConversation = useCallback(async () => {
    if (!classroomId) return;
    setError(null);
    try {
      const created = await createConversation(
        classroomId,
        "Nueva consulta",
        mode,
        guided,
        selectedDocumentIds,
      );
      setConversations((prev) => [created, ...prev]);
      setLocalMode(null);
      setLocalGuided(null);
      setLocalSelectedDocIds(null);
      setActiveConversationId(created.id);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear la conversación.");
    }
  }, [classroomId, guided, mode, selectedDocumentIds]);

  // Rename conversation
  const renameConversation = useCallback(
    async (id: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      try {
        await updateConversation(id, { title: trimmed });
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible renombrar la conversación.");
      }
    },
    [],
  );

  // Delete conversation
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversationApi(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          const remaining = conversations.filter((c) => c.id !== id);
          const firstRemaining = remaining[0];
          if (firstRemaining) {
            selectConversation(firstRemaining.id);
          } else {
            setActiveConversationId(null);
            setMessages([]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible eliminar la conversación.");
      }
    },
    [activeConversationId, conversations, selectConversation],
  );

  // Send message
  const sendMessage = useCallback(
    async (questionText: string) => {
      if (!classroomId) {
        setError("Selecciona un aula activa.");
        return;
      }
      const trimmed = questionText.trim();
      if (!trimmed) return;

      setSending(true);
      setError(null);

      // Optimistic user message
      const optimisticUserMsg: TutorMessageRecord = {
        id: `temp-${Date.now()}`,
        conversationId: activeConversationId ?? "new",
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      try {
        // Prepare context messages history (last 10)
        const historyForBackend = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        historyForBackend.push({ role: "user", content: trimmed });

        const response = await invokeTutorChat({
          classroomId,
          conversationId: activeConversationId,
          messages: historyForBackend,
          mode,
          guided,
          selectedDocumentIds,
        });

        // If conversation was auto-created or active id changed
        if (response.conversationId && response.conversationId !== activeConversationId) {
          setActiveConversationId(response.conversationId);
          await refreshConversations();
        }

        const assistantMsg: TutorMessageRecord = {
          id: response.messageId,
          conversationId: response.conversationId,
          role: "assistant",
          content: response.text,
          model: response.model,
          citations: response.citations,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev.filter((m) => m.id !== optimisticUserMsg.id), optimisticUserMsg, assistantMsg]);
      } catch (sendErr) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
        setError(sendErr instanceof Error ? sendErr.message : "Error al enviar mensaje.");
      } finally {
        setSending(false);
      }
    },
    [activeConversationId, classroomId, guided, messages, mode, refreshConversations, selectedDocumentIds],
  );

  // Open verified citation in PDF Viewer at page
  const openCitation = useCallback(
    async (citation: TutorCitation) => {
      setError(null);
      const targetDoc = documents.find((d) => d.id === citation.documentId);
      if (!targetDoc) {
        setError(
          `El documento “${citation.documentTitle}” ya no está disponible en tu aula o el permiso fue revocado.`,
        );
        return;
      }

      try {
        const blob = await downloadDocument(targetDoc);
        setViewer({
          document: targetDoc,
          page: citation.pageStart,
          blob,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? `No fue posible abrir la referencia: ${err.message}`
            : "No fue posible abrir el PDF citado.",
        );
      }
    },
    [documents],
  );

  return {
    conversations,
    activeConversation,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    error,
    health,
    mode,
    guided,
    selectedDocumentIds,
    viewer,
    selectConversation,
    startNewConversation,
    renameConversation,
    deleteConversation,
    setMode,
    setGuided,
    setSelectedDocumentIds,
    sendMessage,
    openCitation,
    closeViewer: () => setViewer(null),
    clearError: () => setError(null),
  };
}
