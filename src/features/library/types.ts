import type {
  DocumentShareScope,
  DocumentStatus,
  DocumentProcessingPhase,
  DocumentProcessingStatus,
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
  processing: DocumentProcessing | null;
};

export type DocumentProcessing = {
  id: string;
  status: DocumentProcessingStatus;
  phase: DocumentProcessingPhase;
  chunkCount: number;
  embeddedChunkCount: number;
  embeddingTokens: number;
  failureCount: number;
  failureCode: string | null;
  failureDetail: string | null;
  updatedAt: string;
};

export type RagSearchScope = "all" | DocumentScope;

export type RagSearchResult = {
  chunkId: number;
  documentId: string;
  documentTitle: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  semanticSimilarity: number;
  lexicalRank: number;
  combinedScore: number;
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
