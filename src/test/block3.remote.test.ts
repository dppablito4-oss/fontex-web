// @vitest-environment node

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import process from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../lib/supabase/database.types";

const remoteUrl = process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.service_role;
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
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

type SearchPayload = {
  results?: Array<{
    document_id: string;
    document_title: string;
    page_start: number;
    page_end: number;
    content: string;
  }>;
};

suite("Block 3 remote extraction, indexing and retrieval", () => {
  const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const password = `Fontex-${crypto.randomUUID()}-Aa1!`;
  const emails = {
    teacher: `teacher-b3-${runId}@fontex.test`,
    owner: `owner-b3-${runId}@fontex.test`,
    viewer: `viewer-b3-${runId}@fontex.test`,
    outsider: `outsider-b3-${runId}@fontex.test`,
  };
  const userIds: Record<keyof typeof emails, string> = { teacher: "", owner: "", viewer: "", outsider: "" };
  let organizationId: string | null = null;
  let classroomId: string | null = null;
  let groupId: string | null = null;
  let documentId: string | null = null;
  let storagePath: string | null = null;
  let admin: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let viewer: SupabaseClient<Database>;
  let outsider: SupabaseClient<Database>;

  beforeAll(async () => {
    if (!remoteUrl || !publishableKey || !serviceRoleKey) return;
    admin = createClient<Database>(remoteUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const [kind, email] of Object.entries(emails) as Array<[keyof typeof emails, string]>) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Prueba RAG ${kind}` },
      });
      if (created.error) throw created.error;
      userIds[kind] = created.data.user.id;
    }

    const signIn = async (email: string) => {
      const client = createClient<Database>(remoteUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const signedIn = await client.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      return client;
    };
    [owner, viewer, outsider] = await Promise.all([signIn(emails.owner), signIn(emails.viewer), signIn(emails.outsider)]);

    const organization = await admin.from("organizations").insert({ name: `Organización RAG ${runId}`, created_by: userIds.teacher }).select("id").single();
    if (organization.error) throw organization.error;
    organizationId = organization.data.id;
    const classroom = await admin.from("classrooms").insert({
      organization_id: organizationId,
      title: `Aula RAG ${runId}`,
      owner_id: userIds.teacher,
      term: "Prueba",
    }).select("id").single();
    if (classroom.error) throw classroom.error;
    classroomId = classroom.data.id;
    const members = await admin.from("class_members").insert([
      { classroom_id: classroomId, user_id: userIds.owner, invited_by: userIds.teacher },
      { classroom_id: classroomId, user_id: userIds.viewer, invited_by: userIds.teacher },
    ]);
    if (members.error) throw members.error;
    const group = await admin.from("study_groups").insert({
      classroom_id: classroomId,
      name: `Grupo RAG ${runId}`,
      created_by: userIds.teacher,
    }).select("id").single();
    if (group.error) throw group.error;
    groupId = group.data.id;
    const membership = await admin.from("group_members").insert([
      { group_id: groupId, user_id: userIds.owner, added_by: userIds.teacher },
      { group_id: groupId, user_id: userIds.viewer, added_by: userIds.teacher },
    ]);
    if (membership.error) throw membership.error;
  }, 60_000);

  afterAll(async () => {
    if (!remoteConfigured || !admin) return;
    if (storagePath) await admin.storage.from("fontex-documents").remove([storagePath]);
    if (documentId) await admin.from("documents").delete().eq("id", documentId);
    if (classroomId) {
      await admin.from("study_groups").delete().eq("classroom_id", classroomId);
      await admin.from("class_members").delete().eq("classroom_id", classroomId);
      await admin.from("classrooms").delete().eq("id", classroomId);
    }
    if (organizationId) await admin.from("organizations").delete().eq("id", organizationId);
    await Promise.all(Object.values(userIds).filter(Boolean).map((userId) => admin.auth.admin.deleteUser(userId)));
  }, 60_000);

  it("extracts, indexes, retrieves by permission, revokes and cascades", async () => {
    if (!classroomId || !groupId) return;
    const sourceText = `Fontex ATP fotosintesis contexto autorizado ${runId}`;
    const bytes = createSelectablePdf(sourceText);
    const reservation = await owner.rpc("reserve_document_upload", {
      target_classroom_id: classroomId,
      document_title: `Fuente RAG ${runId}`,
      source_filename: "fuente-rag.pdf",
      source_mime_type: "application/pdf",
      source_size_bytes: bytes.byteLength,
      source_page_count: 1,
      source_sha256: await sha256(bytes),
    });
    expect(reservation.error).toBeNull();
    if (!reservation.data || typeof reservation.data !== "object" || Array.isArray(reservation.data)) throw new Error("Invalid reservation.");
    documentId = typeof reservation.data.document_id === "string" ? reservation.data.document_id : null;
    storagePath = typeof reservation.data.storage_path === "string" ? reservation.data.storage_path : null;
    if (!documentId || !storagePath) throw new Error("Missing document identifiers.");

    const form = new FormData();
    form.set("documentId", documentId);
    form.set("file", new File([bytes], "fuente-rag.pdf", { type: "application/pdf" }));
    const uploaded = await owner.functions.invoke("document-upload", { body: form, timeout: 60_000 });
    expect(uploaded.error).toBeNull();

    let complete = false;
    for (let step = 0; step < 5 && !complete; step += 1) {
      const processed = await owner.functions.invoke<{ complete?: boolean; status?: string }>("document-process", {
        body: { documentId },
        timeout: 60_000,
      });
      if (processed.error) {
        const job = await admin.from("document_processing_jobs").select("status, failure_code, failure_detail").eq("document_id", documentId).maybeSingle();
        throw new Error(`Processing failed: ${String(processed.error)}; job=${JSON.stringify(job.data)}`);
      }
      complete = processed.data?.complete === true || processed.data?.status === "ready";
    }
    expect(complete).toBe(true);

    const job = await admin.from("document_processing_jobs").select("id, status, phase, chunk_count, embedded_chunk_count, embedding_tokens").eq("document_id", documentId).single();
    expect(job.error).toBeNull();
    expect(job.data).toMatchObject({ status: "ready", phase: "complete", chunk_count: 1, embedded_chunk_count: 1 });
    expect(job.data?.embedding_tokens).toBeGreaterThan(0);
    const chunks = await admin.from("document_chunks").select("id, page_start, page_end, embedding").eq("document_id", documentId);
    expect(chunks.data).toHaveLength(1);
    expect(chunks.data?.[0]).toMatchObject({ page_start: 1, page_end: 1 });
    expect(chunks.data?.[0]?.embedding).not.toBeNull();
    expect((await owner.from("document_chunks").select("id")).error).not.toBeNull();

    const ownerSearch = await owner.functions.invoke<SearchPayload>("document-search", {
      body: { query: "ATP fotosintesis", scope: "private", matchCount: 5 },
      timeout: 45_000,
    });
    expect(ownerSearch.error).toBeNull();
    expect(ownerSearch.data?.results).toHaveLength(1);
    expect(ownerSearch.data?.results?.[0]).toMatchObject({ document_id: documentId, page_start: 1, page_end: 1 });

    const outsiderSearch = await outsider.functions.invoke<SearchPayload>("document-search", {
      body: { query: "ATP fotosintesis", scope: "all", matchCount: 5 },
      timeout: 45_000,
    });
    expect(outsiderSearch.error).toBeNull();
    expect(outsiderSearch.data?.results).toHaveLength(0);

    const shared = await owner.from("document_shares").insert({
      document_id: documentId,
      scope_type: "group",
      group_id: groupId,
    }).select("id").single();
    expect(shared.error).toBeNull();
    const viewerSearch = await viewer.functions.invoke<SearchPayload>("document-search", {
      body: { query: "ATP fotosintesis", scope: "group", matchCount: 5 },
      timeout: 45_000,
    });
    expect(viewerSearch.error).toBeNull();
    expect(viewerSearch.data?.results).toHaveLength(1);

    if (!shared.data) throw new Error("Missing group share.");
    expect((await owner.from("document_shares").delete().eq("id", shared.data.id)).error).toBeNull();
    const revokedSearch = await viewer.functions.invoke<SearchPayload>("document-search", {
      body: { query: "ATP fotosintesis", scope: "group", matchCount: 5 },
      timeout: 45_000,
    });
    expect(revokedSearch.error).toBeNull();
    expect(revokedSearch.data?.results).toHaveLength(0);

    const deleted = await owner.functions.invoke("document-delete", { body: { documentId }, timeout: 45_000 });
    expect(deleted.error).toBeNull();
    expect((await admin.from("document_processing_jobs").select("id").eq("document_id", documentId)).data).toHaveLength(0);
    expect((await admin.from("document_chunks").select("id").eq("document_id", documentId)).data).toHaveLength(0);
    documentId = null;
    storagePath = null;
  }, 180_000);
});
