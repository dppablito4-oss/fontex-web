import { ArrowUpRight, BookOpen, History, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { useAuth } from "../auth/AuthProvider";
import { PdfViewer } from "../library/components/PdfViewer";
import { useDocuments } from "../library/hooks/useDocuments";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { ChatArea } from "./components/ChatArea";
import { ConversationList } from "./components/ConversationList";
import { SourceSelectorPanel } from "./components/SourceSelectorPanel";
import { useTutor } from "./hooks/useTutor";
import type { TutorCitation } from "./types";

type Panel = "conversations" | "sources";

export function TutorPage() {
  const { status } = useAuth();
  const { activeClassroom } = useWorkspace();
  const [panel, setPanel] = useState<Panel | null>(null);

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
    <div className="flex h-[calc(100dvh-4rem)] min-h-[400px] flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight">Tutor documental</h1>
          {activeClassroom && <p className="truncate text-xs text-muted-foreground">{activeClassroom.title}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button asChild size="sm" variant="ghost"><Link to="/demo">Matemática <ArrowUpRight className="size-3.5" /></Link></Button>
          <Button aria-expanded={panel === "conversations"} onClick={() => setPanel(panel === "conversations" ? null : "conversations")} size="sm" type="button" variant={panel === "conversations" ? "secondary" : "ghost"}><History className="size-4" /> Historial</Button>
          <Button aria-expanded={panel === "sources"} onClick={() => setPanel(panel === "sources" ? null : "sources")} size="sm" type="button" variant={panel === "sources" ? "secondary" : "ghost"}><BookOpen className="size-4" /> Fuentes</Button>
        </div>
      </header>

      <div className={`grid min-h-0 flex-1 ${panel ? "lg:grid-cols-[minmax(0,1fr)_minmax(16rem,19rem)]" : ""}`}>
        <div className={`min-h-0 min-w-0 ${panel ? "hidden lg:flex" : "flex"}`}>
          <ChatArea
            messages={tutor.messages}
            sending={tutor.sending}
            error={tutor.error}
            hasClassroom={Boolean(activeClassroom)}
            mode={tutor.mode}
            guided={tutor.guided}
            onSetMode={(mode) => void tutor.setMode(mode)}
            onSetGuided={(guided) => void tutor.setGuided(guided)}
            onSendMessage={(text) => void tutor.sendMessage(text)}
            onOpenCitation={(citation) => void tutor.openCitation(citation)}
            onClearError={tutor.clearError}
          />
        </div>
        {panel && (
          <aside aria-label={panel === "sources" ? "Fuentes" : "Historial"} className="flex min-h-0 flex-col overflow-hidden bg-sidebar lg:border-l lg:border-border">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
              <h2 className="text-sm font-bold">{panel === "sources" ? "Fuentes" : "Historial"}</h2>
              <Button aria-label="Cerrar panel" className="size-8" onClick={() => setPanel(null)} size="icon" type="button" variant="ghost"><X className="size-4" /></Button>
            </div>
            <div className="min-h-0 flex-1">
              {panel === "conversations" ? (
                <ConversationList
                  conversations={tutor.conversations}
                  activeId={tutor.activeConversationId}
                  loading={tutor.loadingConversations}
                  onSelect={(id) => { tutor.selectConversation(id); setPanel(null); }}
                  onNew={() => { void tutor.startNewConversation(); setPanel(null); }}
                  onRename={(id, title) => void tutor.renameConversation(id, title)}
                  onDelete={(id) => void tutor.deleteConversation(id)}
                />
              ) : (
                <SourceSelectorPanel
                  documents={library.documents}
                  selectedIds={tutor.selectedDocumentIds}
                  onSelectIds={(ids) => void tutor.setSelectedDocumentIds(ids)}
                  citations={activeCitations}
                  onOpenCitation={(citation) => void tutor.openCitation(citation)}
                />
              )}
            </div>
          </aside>
        )}
      </div>
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
