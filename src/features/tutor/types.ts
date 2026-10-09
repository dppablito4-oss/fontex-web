import type { TutorMode } from "../../lib/supabase/database.types";

export type { TutorMode };

export type TutorCitation = {
  id?: string;
  chunkId: number;
  documentId: string;
  documentTitle: string;
  pageStart: number;
  pageEnd: number;
  chunkVersion?: string;
};

export type TutorConversation = {
  id: string;
  classroomId: string;
  userId: string;
  title: string;
  mode: TutorMode;
  guided: boolean;
  selectedDocumentIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type TutorMessageRecord = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  citations?: TutorCitation[];
  createdAt: string;
};

export type TutorHealthStatus = {
  configured: boolean;
  available: boolean;
  model: string;
  error?: string | null;
};
