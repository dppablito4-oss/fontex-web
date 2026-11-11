import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { downloadDocument } from "../../library/services/documentService";
import type { LibraryDocument } from "../../library/types";
import {
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
  const [localMode, setLocalMode] = useState<TutorMode | null>(null);
  const [localGuided, setLocalGuided] = useState<boolean | null>(null);
  const [localSelectedDocIds, setLocalSelectedDocIds] = useState<string[] | null>(null);
  const [viewer, setViewer] = useState<{
    document: LibraryDocument;
    page: number;
    blob: Blob;
  } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const epochRef = useRef(0);
  const readRef = useRef(0);
  const invalidateRequest = useCallback(() => {
    epochRef.current += 1;
    readRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    setSending(false);
    setMessages((previous) => previous.filter((message) => !message.id.startsWith("temp-")));
    setViewer(null);
  }, []);
  useLayoutEffect(() => {
    return () => {
      epochRef.current += 1;
      readRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [classroomId]);

  // Refresh conversations when classroom changes
  const refreshConversations = useCallback(async () => {
    const epoch = epochRef.current;
    setSending(requestRef.current !== null);
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
      if (epochRef.current !== epoch) return;
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
      if (epochRef.current !== epoch) return;
      setError(err instanceof Error ? err.message : "Error al cargar conversaciones.");
    } finally {
      if (epochRef.current === epoch) setLoadingConversations(false);
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
    const read = ++readRef.current;
    const timer = window.setTimeout(() => {
      setLoadingMessages(true);
      setError(null);

      void listMessages(activeConversationId)
        .then((msgs) => {
          if (!active || readRef.current !== read) return;
          setMessages(msgs);
        })
        .catch((err) => {
          if (!active || readRef.current !== read) return;
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
    if (id === activeConversationId) return;
    invalidateRequest();
    setMessages([]);
    setLocalMode(null);
    setLocalGuided(null);
    setLocalSelectedDocIds(null);
    setActiveConversationId(id);
  }, [activeConversationId, invalidateRequest]);

  // Start new conversation
  const startNewConversation = useCallback(async () => {
    if (!classroomId) return;
    invalidateRequest();
    const epoch = epochRef.current;
    setError(null);
    try {
      const created = await createConversation(
        classroomId,
        "Nueva consulta",
        mode,
        guided,
        selectedDocumentIds,
      );
      if (epochRef.current !== epoch) return;
      setConversations((prev) => [created, ...prev]);
      setLocalMode(null);
      setLocalGuided(null);
      setLocalSelectedDocIds(null);
      setActiveConversationId(created.id);
      setMessages([]);
    } catch (err) {
      if (epochRef.current !== epoch) return;
      setError(err instanceof Error ? err.message : "No fue posible crear la conversación.");
    }
  }, [classroomId, guided, invalidateRequest, mode, selectedDocumentIds]);

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
      if (activeConversationId === id) invalidateRequest();
      const epoch = epochRef.current;
      try {
        await deleteConversationApi(id);
        if (epochRef.current !== epoch) return;
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
    [activeConversationId, conversations, invalidateRequest, selectConversation],
  );

  // Send message
  const sendMessage = useCallback(
    async (questionText: string) => {
      if (requestRef.current) return;
      if (!classroomId) {
        setError("Selecciona un aula activa.");
        return;
      }
      const trimmed = questionText.trim();
      if (!trimmed) return;
      const controller = new AbortController();
      requestRef.current = controller;
      const epoch = epochRef.current;
      readRef.current += 1;
      const currentRequest = () => epochRef.current === epoch && requestRef.current === controller && !controller.signal.aborted;

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
          signal: controller.signal,
        });
        if (!currentRequest()) return;

        // If conversation was auto-created or active id changed
        if (response.conversationId && response.conversationId !== activeConversationId) {
          setActiveConversationId(response.conversationId);
          await refreshConversations();
        }
        if (!currentRequest()) return;
        const persisted = await listMessages(response.conversationId);
        if (currentRequest()) setMessages(persisted);
      } catch (sendErr) {
        if (!currentRequest()) return;
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
        setError(sendErr instanceof Error ? sendErr.message : "Error al enviar mensaje.");
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setSending(false);
        }
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
