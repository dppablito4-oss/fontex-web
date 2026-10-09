import { supabase } from "../../../lib/supabase/client";
import type { Database } from "../../../lib/supabase/database.types";
import type {
  TutorCitation,
  TutorConversation,
  TutorHealthStatus,
  TutorMessageRecord,
  TutorMode,
} from "../types";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");
  return supabase;
}

function readableDataError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "No tienes permiso para realizar esta acción.";
  }
  return message;
}

async function readableFunctionError(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== "object") return fallback;
  const context: unknown = Reflect.get(error, "context");
  if (!(context instanceof Response)) return fallback;
  try {
    const payload: unknown = await context.json();
    if (payload && typeof payload === "object") {
      const message: unknown = Reflect.get(payload, "message");
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

type HealthResponse = {
  ready?: boolean;
  model?: string;
};

export async function checkTutorHealth(): Promise<TutorHealthStatus> {
  if (!supabase) {
    return {
      configured: false,
      available: false,
      model: "Demo local",
    };
  }

  try {
    const invocation = await supabase.functions.invoke<HealthResponse>("tutor-chat", {
      body: { action: "health" },
      timeout: 10_000,
    });

    if (invocation.error || !invocation.data) {
      return {
        configured: true,
        available: false,
        model: "gpt-6-astra",
        error: invocation.error
          ? await readableFunctionError(invocation.error, "Servicio no disponible")
          : "Sin respuesta",
      };
    }

    return {
      configured: true,
      available: Boolean(invocation.data.ready),
      model: invocation.data.model || "gpt-6-astra",
    };
  } catch (err) {
    return {
      configured: true,
      available: false,
      model: "gpt-6-astra",
      error: err instanceof Error ? err.message : "Error al conectar con el tutor",
    };
  }
}

export async function listConversations(classroomId: string): Promise<TutorConversation[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tutor_conversations")
    .select("id, classroom_id, user_id, title, mode, guided, selected_document_ids, created_at, updated_at")
    .eq("classroom_id", classroomId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(readableDataError(error.message));
  if (!data) return [];

  return data.map((conv) => ({
    id: conv.id,
    classroomId: conv.classroom_id,
    userId: conv.user_id,
    title: conv.title,
    mode: conv.mode,
    guided: conv.guided,
    selectedDocumentIds: conv.selected_document_ids ?? [],
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
  }));
}

export async function createConversation(
  classroomId: string,
  title: string,
  mode: TutorMode = "strict",
  guided = false,
  selectedDocumentIds: string[] = [],
): Promise<TutorConversation> {
  const client = requireSupabase();
  const insertPayload: Database["public"]["Tables"]["tutor_conversations"]["Insert"] = {
    classroom_id: classroomId,
    title: title.trim() || "Nueva consulta",
    mode,
    guided,
    selected_document_ids: selectedDocumentIds,
  };

  const { data, error } = await client
    .from("tutor_conversations")
    .insert(insertPayload)
    .select("id, classroom_id, user_id, title, mode, guided, selected_document_ids, created_at, updated_at")
    .single();

  if (error) throw new Error(readableDataError(error.message));
  if (!data) throw new Error("No fue posible crear la conversación.");

  return {
    id: data.id,
    classroomId: data.classroom_id,
    userId: data.user_id,
    title: data.title,
    mode: data.mode,
    guided: data.guided,
    selectedDocumentIds: data.selected_document_ids ?? [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateConversation(
  conversationId: string,
  updates: {
    title?: string;
    mode?: TutorMode;
    guided?: boolean;
    selectedDocumentIds?: string[];
  },
): Promise<void> {
  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["tutor_conversations"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.mode !== undefined) payload.mode = updates.mode;
  if (updates.guided !== undefined) payload.guided = updates.guided;
  if (updates.selectedDocumentIds !== undefined) payload.selected_document_ids = updates.selectedDocumentIds;

  const { error } = await client
    .from("tutor_conversations")
    .update(payload)
    .eq("id", conversationId);

  if (error) throw new Error(readableDataError(error.message));
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("tutor_conversations")
    .delete()
    .eq("id", conversationId);

  if (error) throw new Error(readableDataError(error.message));
}

type CitationRow = {
  id: string;
  chunk_id: number;
  document_id: string;
  document_title: string;
  page_start: number;
  page_end: number;
  document_version: string | null;
};

export async function listMessages(conversationId: string): Promise<TutorMessageRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tutor_messages")
    .select(`
      id,
      conversation_id,
      role,
      content,
      model,
      created_at,
      tutor_message_citations (
        id,
        chunk_id,
        document_id,
        page_start,
        page_end,
        document_title,
        document_version
      )
    `)
    .eq("conversation_id", conversationId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(readableDataError(error.message));
  if (!data) return [];

  return data.map((msg) => {
    const rawCitations = (msg.tutor_message_citations ?? []) as unknown as CitationRow[];
    const citations: TutorCitation[] = Array.isArray(rawCitations)
      ? rawCitations.map((c) => ({
          id: c.id,
          chunkId: c.chunk_id,
          documentId: c.document_id,
          documentTitle: c.document_title,
          pageStart: c.page_start,
          pageEnd: c.page_end,
          chunkVersion: c.document_version ?? undefined,
        }))
      : [];

    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      model: msg.model,
      citations,
      createdAt: msg.created_at,
    };
  });
}

type InvokeTutorParams = {
  classroomId: string;
  conversationId: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  mode: TutorMode;
  guided: boolean;
  selectedDocumentIds: string[];
  scope?: "all" | "private" | "group" | "classroom";
  signal?: AbortSignal;
};

type TutorInvokeResponse = {
  text: string;
  model: string;
  mode: TutorMode;
  guided: boolean;
  conversationId: string;
  messageId: string;
  citations: Array<{
    chunkId: number;
    documentId: string;
    documentTitle: string;
    pageStart: number;
    pageEnd: number;
    chunkVersion?: string;
  }>;
  retrievedCount?: number;
};

export async function invokeTutorChat(params: InvokeTutorParams): Promise<TutorInvokeResponse> {
  if (!supabase) {
    return {
      text: "En modo demostración local no se realizan llamadas externas ni se accede a documentos reales. Conecta Supabase e ingresa a tu aula para fundamentar respuestas con RAG.",
      model: "Demo local",
      mode: params.mode,
      guided: params.guided,
      conversationId: params.conversationId || "demo-conv",
      messageId: `demo-${Date.now()}`,
      citations: [],
      retrievedCount: 0,
    };
  }

  const client = requireSupabase();
  const invocation = await client.functions.invoke<TutorInvokeResponse>("tutor-chat", {
    body: {
      classroomId: params.classroomId,
      conversationId: params.conversationId,
      messages: params.messages,
      mode: params.mode,
      guided: params.guided,
      selectedDocumentIds: params.selectedDocumentIds,
      scope: params.scope ?? "all",
      idempotencyKey: crypto.randomUUID(),
    },
    signal: params.signal,
    timeout: 50_000,
  });

  if (invocation.error) {
    throw new Error(await readableFunctionError(invocation.error, "No fue posible obtener respuesta del tutor."));
  }

  if (!invocation.data || typeof invocation.data !== "object") {
    throw new Error("El tutor devolvió una respuesta vacía del servidor.");
  }

  return invocation.data;
}
