import type {
  DocumentShareScope,
  DocumentStatus,
} from "../../lib/supabase/database.types";

export type DocumentShare = {
  id: string;
  documentId: string;
  scopeType: DocumentShareScope;
  classroomId: string | null;
  groupId: string | null;
  grantedBy: string;
};

export type LibraryDocument = {
  id: string;
  ownerId: string;
  classroomId: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  storagePath: string;
  status: DocumentStatus;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
  shares: DocumentShare[];
};

export type DocumentLimits = {
  maxFileBytes: number;
  maxPages: number;
  maxDocumentsPerUser: number;
  maxBytesPerUser: number;
  maxBytesPerClassroom: number;
  maxBytesGlobal: number;
};

export type PreparedPdf = {
  file: File;
  title: string;
  pageCount: number;
  sha256: string;
};

export type UploadScope =
  | { type: "private" }
  | { type: "group"; groupId: string }
  | { type: "classroom" };

export type DocumentScope = "private" | "group" | "classroom";

export function getDocumentScope(document: LibraryDocument): DocumentScope {
  if (document.shares.some((share) => share.scopeType === "classroom")) return "classroom";
  if (document.shares.some((share) => share.scopeType === "group")) return "group";
  return "private";
}
