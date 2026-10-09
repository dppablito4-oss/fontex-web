import { BookOpen, FolderOpen, Layers, MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { useAuth } from "../auth/AuthProvider";
import { PdfViewer } from "../library/components/PdfViewer";
import { useDocuments } from "../library/hooks/useDocuments";
import { PageHeader } from "../shared/PageHeader";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { ChatArea } from "./components/ChatArea";
import { ConversationList } from "./components/ConversationList";
import { SourceSelectorPanel } from "./components/SourceSelectorPanel";
import { useTutor } from "./hooks/useTutor";
import type { TutorCitation } from "./types";

type MobileTab = "conversations" | "chat" | "sources";

export function TutorPage() {
  const { status } = useAuth();
  const { activeClassroom } = useWorkspace();
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  const library = useDocuments({
    classroomId: activeClassroom?.id ?? null,
    enabled: status === "authenticated",
  });

  const tutor = useTutor({
    classroomId: activeClassroom?.id ?? null,
    documents: library.documents,
  });

  // Extract all citations from the active conversation's assistant messages
  const activeCitations = useMemo(() => {
    const list: TutorCitation[] = [];
    const seen = new Set<string>();

    for (const msg of tutor.messages) {
      if (msg.role === "assistant" && msg.citations) {
        for (const c of msg.citations) {
          const key = `${c.documentId}-${c.chunkId}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push(c);
          }
        }
      }
    }
    return list;
  }, [tutor.messages]);

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-surface px-4 py-4 sm:px-6">
        <PageHeader
          eyebrow="Tutor documental"
          title="Tutor Académico Documental"
          description="Razonamiento contextual fundamentado en los documentos autorizados de tu aula."
          action={
            activeClassroom ? (
              <Badge tone="blue" className="text-xs">
                {activeClassroom.title}
              </Badge>
            ) : (
              <Badge tone="orange" className="text-xs">
                Modo Demostración
              </Badge>
            )
          }
        />
      </div>

      {!activeClassroom && (
        <div className="flex items-center gap-2 border-b border-border bg-subtle/50 px-4 py-2 text-xs text-muted-foreground">
          <FolderOpen className="size-4 shrink-0 text-amber-500" />
          <span>
            Sin aula activa. Puedes probar preguntas y modos de estudio demostrativos; para consultar tus PDFs reales selecciona un aula en el menú superior.
          </span>
        </div>
      )}

      {/* Mobile Tab Switcher (< lg) */}
      <div className="flex border-b border-border bg-surface lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("conversations")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            mobileTab === "conversations"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="size-3.5" />
          Chats ({tutor.conversations.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            mobileTab === "chat"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="size-3.5" />
          Tutor
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("sources")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            mobileTab === "sources"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="size-3.5" />
          Fuentes ({tutor.selectedDocumentIds.length || "Todas"})
        </button>
      </div>

      {/* 3-Column Workspace */}
      <div className="grid flex-1 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        {/* Left Column: Conversation List */}
        <div
          className={`border-r border-border bg-sidebar overflow-hidden ${
            mobileTab === "conversations" ? "flex flex-col h-full" : "hidden lg:flex lg:flex-col"
          }`}
        >
          <ConversationList
            conversations={tutor.conversations}
            activeId={tutor.activeConversationId}
            loading={tutor.loadingConversations}
            onSelect={(id) => {
              tutor.selectConversation(id);
              setMobileTab("chat");
            }}
            onNew={() => {
              void tutor.startNewConversation();
              setMobileTab("chat");
            }}
            onRename={(id, title) => void tutor.renameConversation(id, title)}
            onDelete={(id) => void tutor.deleteConversation(id)}
          />
        </div>

        {/* Center Column: Chat Area */}
        <div
          className={`overflow-hidden ${
            mobileTab === "chat" ? "flex flex-col h-full" : "hidden lg:flex lg:flex-col"
          }`}
        >
          <ChatArea
            messages={tutor.messages}
            sending={tutor.sending}
            error={tutor.error}
            health={tutor.health}
            mode={tutor.mode}
            guided={tutor.guided}
            onSetMode={(m) => void tutor.setMode(m)}
            onSetGuided={(g) => void tutor.setGuided(g)}
            onSendMessage={(txt) => void tutor.sendMessage(txt)}
            onOpenCitation={(c) => void tutor.openCitation(c)}
            onClearError={tutor.clearError}
          />
        </div>

        {/* Right Column: Source Selector Panel */}
        <div
          className={`border-l border-border bg-sidebar overflow-hidden ${
            mobileTab === "sources" ? "flex flex-col h-full" : "hidden lg:flex lg:flex-col"
          }`}
        >
          <SourceSelectorPanel
            documents={library.documents}
            selectedIds={tutor.selectedDocumentIds}
            onSelectIds={(ids) => void tutor.setSelectedDocumentIds(ids)}
            citations={activeCitations}
            onOpenCitation={(c) => void tutor.openCitation(c)}
          />
        </div>
      </div>

      {/* PDF Viewer Modal when citation is clicked */}
      {tutor.viewer && (
        <PdfViewer
          blob={tutor.viewer.blob}
          document={tutor.viewer.document}
          initialPage={tutor.viewer.page}
          onClose={tutor.closeViewer}
        />
      )}
    </div>
  );
}
