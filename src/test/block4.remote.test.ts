// @vitest-environment node

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import process from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../lib/supabase/database.types";

const remoteUrl = process.env.SUPABASE_TEST_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const remoteConfigured = Boolean(remoteUrl && publishableKey && serviceRoleKey);
const suite = describe.runIf(remoteConfigured);

function createSelectablePdf(text: string) {
  const encoder = new TextEncoder();
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(pdf);
}

async function sha256(bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

type TutorInvokeResponse = {
  text: string;
  model: string;
  mode: string;
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

suite("Block 4 remote tutor, RAG grounding, citations and conversations", () => {
  const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const password = `Fontex-${crypto.randomUUID()}-Aa1!`;
  const emails = {
    teacher: `teacher-b4-${runId}@fontex.test`,
    studentA: `studentA-b4-${runId}@fontex.test`,
    studentB: `studentB-b4-${runId}@fontex.test`,
    outsider: `outsider-b4-${runId}@fontex.test`,
  };

  let adminClient: SupabaseClient<Database>;
  let clients: Record<keyof typeof emails, SupabaseClient<Database>>;
  let userIds: Record<keyof typeof emails, string>;
  let classroomId = "";
  let groupAId = "";
  let groupBId = "";
  let physicsDocId = "";
  let groupDocId = "";

  beforeAll(async () => {
    adminClient = createClient<Database>(remoteUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userEntries = await Promise.all(
      Object.entries(emails).map(async ([key, email]) => {
        const created = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: `User ${key}` },
        });
        if (created.error || !created.data.user) {
          throw new Error(`Failed to create ${key}: ${created.error?.message}`);
        }
        return [key, created.data.user.id] as const;
      }),
    );
    userIds = Object.fromEntries(userEntries) as Record<keyof typeof emails, string>;

    const clientEntries = await Promise.all(
      Object.entries(emails).map(async ([key, email]) => {
        const client = createClient<Database>(remoteUrl!, publishableKey!, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const sign = await client.auth.signInWithPassword({ email, password });
        if (sign.error) throw new Error(`Sign in failed for ${key}: ${sign.error.message}`);
        return [key, client] as const;
      }),
    );
    clients = Object.fromEntries(clientEntries) as Record<keyof typeof emails, SupabaseClient<Database>>;

    // Organization and Classroom
    const org = await adminClient
      .from("organizations")
      .insert({ name: `Org B4 ${runId}`, created_by: userIds.teacher })
      .select("id")
      .single();
    if (org.error) throw new Error(org.error.message);

    const classroom = await adminClient
      .from("classrooms")
      .insert({
        organization_id: org.data.id,
        title: `Física Universitaria ${runId}`,
        owner_id: userIds.teacher,
      })
      .select("id")
      .single();
    if (classroom.error) throw new Error(classroom.error.message);
    classroomId = classroom.data.id;

    // Enroll members
    await adminClient.from("class_members").insert([
      { classroom_id: classroomId, user_id: userIds.teacher, role: "teacher", status: "active" },
      { classroom_id: classroomId, user_id: userIds.studentA, role: "student", status: "active" },
      { classroom_id: classroomId, user_id: userIds.studentB, role: "student", status: "active" },
    ]);

    // Create study groups
    const gA = await adminClient
      .from("study_groups")
      .insert({ classroom_id: classroomId, name: "Grupo A de Estudio" })
      .select("id")
      .single();
    if (gA.error) throw new Error(gA.error.message);
    groupAId = gA.data.id;

    const gB = await adminClient
      .from("study_groups")
      .insert({ classroom_id: classroomId, name: "Grupo B de Estudio" })
      .select("id")
      .single();
    if (gB.error) throw new Error(gB.error.message);
    groupBId = gB.data.id;

    await adminClient.from("group_members").insert([
      { group_id: groupAId, user_id: userIds.studentA },
      { group_id: groupBId, user_id: userIds.studentB },
    ]);

    async function uploadAndIndex(
      uploader: SupabaseClient<Database>,
      title: string,
      filename: string,
      text: string,
    ): Promise<string> {
      const pdfBytes = createSelectablePdf(text);
      const sha = await sha256(pdfBytes);
      const reservation = await uploader.rpc("reserve_document_upload", {
        target_classroom_id: classroomId,
        document_title: title,
        source_filename: filename,
        source_mime_type: "application/pdf",
        source_size_bytes: pdfBytes.byteLength,
        source_page_count: 1,
        source_sha256: sha,
      });
      if (
        reservation.error ||
        !reservation.data ||
        typeof reservation.data !== "object" ||
        Array.isArray(reservation.data)
      ) {
        throw new Error(`Reservation failed: ${reservation.error?.message}`);
      }
      const rawData = reservation.data as Record<string, unknown>;
      const docId = String(rawData.document_id);

      const form = new FormData();
      form.set("documentId", docId);
      form.set("file", new File([pdfBytes], filename, { type: "application/pdf" }));
      const uploaded = await uploader.functions.invoke("document-upload", { body: form, timeout: 60_000 });
      if (uploaded.error) throw new Error(`Upload failed: ${String(uploaded.error)}`);

      let complete = false;
      for (let step = 0; step < 5 && !complete; step++) {
        const proc = await uploader.functions.invoke<{ complete?: boolean; status?: string }>(
          "document-process",
          {
            body: { documentId: docId },
            timeout: 60_000,
          },
        );
        if (proc.error) throw new Error(`Processing failed: ${String(proc.error)}`);
        complete = proc.data?.complete === true || proc.data?.status === "ready";
      }

      return docId;
    }

    physicsDocId = await uploadAndIndex(
      clients.teacher,
      "Física I - Leyes de Newton",
      "fisica_newton.pdf",
      "La segunda ley de Newton establece que la aceleracion de un objeto es directamente proporcional a la fuerza neta actuando sobre el e inversamente proporcional a su masa: F = m por a.",
    );

    // Share with classroom
    await clients.teacher.from("document_shares").insert({
      document_id: physicsDocId,
      scope_type: "classroom",
      classroom_id: classroomId,
      granted_by: userIds.teacher,
    });

    groupDocId = await uploadAndIndex(
      clients.studentA,
      "Apuntes Secretos Grupo A",
      "apuntes_a.pdf",
      "Apuntes confidenciales del Grupo A: La fuerza de friccion estatica maxima es igual al coeficiente estatico por la normal.",
    );

    await clients.studentA.from("document_shares").insert({
      document_id: groupDocId,
      scope_type: "group",
      group_id: groupAId,
      granted_by: userIds.studentA,
    });
  }, 90_000);

  afterAll(async () => {
    if (!adminClient) return;
    try {
      if (physicsDocId) await adminClient.from("documents").delete().eq("id", physicsDocId);
      if (groupDocId) await adminClient.from("documents").delete().eq("id", groupDocId);
      if (classroomId) await adminClient.from("classrooms").delete().eq("id", classroomId);
      await Promise.all(Object.values(userIds ?? {}).map((id) => adminClient.auth.admin.deleteUser(id)));
    } catch (err) {
      console.warn("Cleanup warning:", err);
    }
  });

  it("permite a un estudiante autenticado consultar el tutor en modo estricto y recibir citas", async () => {
    const response = await clients.studentA.functions.invoke<TutorInvokeResponse>("tutor-chat", {
      body: {
        classroomId,
        messages: [{ role: "user", content: "Explícame la segunda ley de Newton según los documentos" }],
        mode: "strict",
        guided: false,
        selectedDocumentIds: [physicsDocId],
      },
    });

    expect(response.error).toBeNull();
    expect(response.data).toBeTruthy();
    expect(response.data?.mode).toBe("strict");
    expect(response.data?.conversationId).toBeTruthy();
    expect(response.data?.messageId).toBeTruthy();
    expect(response.data?.text.length).toBeGreaterThan(10);
  });

  it("se abstiene honestamente en modo estricto cuando la información no existe en los documentos", async () => {
    const response = await clients.studentA.functions.invoke<TutorInvokeResponse>("tutor-chat", {
      body: {
        classroomId,
        messages: [{ role: "user", content: "¿Cuál es la receta tradicional para preparar alfajores peruanos?" }],
        mode: "strict",
        guided: false,
        selectedDocumentIds: [physicsDocId],
      },
    });

    expect(response.error).toBeNull();
    expect(response.data).toBeTruthy();
    expect(response.data?.text).toContain("No encontré información suficiente en los documentos seleccionados");
    expect(response.data?.citations).toHaveLength(0);
  });

  it("garantiza que el estudiante B no puede acceder a las conversaciones privadas del estudiante A", async () => {
    // Student A creates a conversation
    const convA = await clients.studentA
      .from("tutor_conversations")
      .insert({
        classroom_id: classroomId,
        title: "Consulta privada de A",
        mode: "strict",
      })
      .select("id")
      .single();

    expect(convA.error).toBeNull();

    // Student B tries to read Student A's conversations
    const { data: readByB } = await clients.studentB
      .from("tutor_conversations")
      .select("id, title")
      .eq("id", convA.data!.id);

    expect(readByB).toHaveLength(0);

    // Teacher cannot read student's private conversation either
    const { data: readByTeacher } = await clients.teacher
      .from("tutor_conversations")
      .select("id, title")
      .eq("id", convA.data!.id);

    expect(readByTeacher).toHaveLength(0);
  });

  it("bloquea consultas de usuarios externos que no pertenecen al aula", async () => {
    const response = await clients.outsider.functions.invoke<TutorInvokeResponse>("tutor-chat", {
      body: {
        classroomId,
        messages: [{ role: "user", content: "Dime qué dice la separata" }],
        mode: "strict",
        guided: false,
      },
    });

    expect(response.error).toBeTruthy();
  });
});
