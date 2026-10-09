import { Check, Edit2, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../components/ui/button";
import type { TutorConversation } from "../types";

export function ConversationList({
  conversations,
  activeId,
  loading,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  conversations: TutorConversation[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startRename = (conv: TutorConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Seguro que deseas eliminar esta conversación?")) {
      onDelete(id);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b border-border">
        <Button
          onClick={onNew}
          className="w-full justify-center gap-2 shadow-sm"
          size="sm"
        >
          <Plus className="size-4" />
          Nueva consulta
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Historial de consultas
        </p>

        {loading && (
          <p className="p-3 text-xs text-muted-foreground">Cargando conversaciones…</p>
        )}

        {!loading && conversations.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 text-center">
            <MessageSquare className="mx-auto size-5 text-muted-foreground opacity-50" />
            <p className="mt-2 text-xs text-muted-foreground">Sin consultas previas.</p>
          </div>
        )}

        {conversations.map((conv) => {
          const isActive = conv.id === activeId;
          const isEditing = editingId === conv.id;

          if (isEditing) {
            return (
              <form
                key={conv.id}
                onSubmit={(e) => saveRename(conv.id, e)}
                className="flex items-center gap-1 rounded-xl bg-surface p-1.5 border border-primary shadow-sm"
              >
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  autoFocus
                  className="flex-1 min-w-0 bg-transparent px-2 py-1 text-xs text-foreground outline-none"
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={(e) => saveRename(conv.id, e)}
                  className="p-1 text-success hover:opacity-80"
                  title="Guardar"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={cancelRename}
                  className="p-1 text-muted-foreground hover:opacity-80"
                  title="Cancelar"
                >
                  <X className="size-3.5" />
                </button>
              </form>
            );
          }

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`group relative flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-foreground hover:bg-subtle"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <MessageSquare className={`size-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                <span className="truncate text-xs">{conv.title}</span>
              </div>

              <div
                className={`flex items-center gap-1 shrink-0 ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => startRename(conv, e)}
                  className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                  title="Renombrar"
                >
                  <Edit2 className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(conv.id, e)}
                  className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                    isActive ? "text-primary-foreground" : "text-error"
                  }`}
                  title="Eliminar"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
