import type { StudyGroup } from "../../workspace/WorkspaceProvider";
import type { LibraryDocument, UploadScope } from "../types";
import { DocumentCard } from "./DocumentCard";

export function DocumentList({
  documents,
  userId,
  ownerNames,
  groups,
  teacher,
  pendingAction,
  onOpen,
  onDownload,
  onDelete,
  onShare,
  onRevoke,
}: {
  documents: LibraryDocument[];
  userId: string | null;
  ownerNames: Map<string, string>;
  groups: StudyGroup[];
  teacher: boolean;
  pendingAction: string | null;
  onOpen: (document: LibraryDocument) => Promise<void>;
  onDownload: (document: LibraryDocument) => Promise<void>;
  onDelete: (document: LibraryDocument) => Promise<void>;
  onShare: (document: LibraryDocument, scope: Exclude<UploadScope, { type: "private" }>) => Promise<void>;
  onRevoke: (shareId: string, documentId: string) => Promise<void>;
}) {
  return (
    <div>
      {documents.map((document) => (
        <DocumentCard
          document={document}
          groups={groups}
          key={document.id}
          owner={document.ownerId === userId}
          ownerName={ownerNames.get(document.ownerId) ?? "Integrante del aula"}
          pendingAction={pendingAction}
          teacher={teacher}
          onDelete={() => onDelete(document)}
          onDownload={() => onDownload(document)}
          onOpen={() => onOpen(document)}
          onRevoke={(shareId) => onRevoke(shareId, document.id)}
          onShare={(scope) => onShare(document, scope)}
        />
      ))}
    </div>
  );
}
