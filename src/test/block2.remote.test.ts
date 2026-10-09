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

function createSelectablePdf() {
  const encoder = new TextEncoder();
  const stream = "BT /F1 18 Tf 72 720 Td (Fontex documento real) Tj ET\n";
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
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

suite("Block 2 remote Storage and RLS", () => {
  const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const password = `Fontex-${crypto.randomUUID()}-Aa1!`;
  const emails = {
    teacher: `teacher-b2-${runId}@fontex.test`,
    studentA: `student-a-b2-${runId}@fontex.test`,
    studentB: `student-b-b2-${runId}@fontex.test`,
    studentC: `student-c-b2-${runId}@fontex.test`,
    outsider: `outsider-b2-${runId}@fontex.test`,
  };
  const userIds: Record<keyof typeof emails, string> = {
    teacher: "",
    studentA: "",
    studentB: "",
    studentC: "",
    outsider: "",
  };
  let organizationId: string | null = null;
  let classroomId: string | null = null;
  let groupAId: string | null = null;
  let groupBId: string | null = null;
  let admin: SupabaseClient<Database>;
  let teacher: SupabaseClient<Database>;
  let studentA: SupabaseClient<Database>;
  let studentB: SupabaseClient<Database>;
  let studentC: SupabaseClient<Database>;
  let outsider: SupabaseClient<Database>;
  const storagePaths = new Set<string>();

  beforeAll(async () => {
    if (!remoteUrl || !publishableKey || !serviceRoleKey) return;
    admin = createClient<Database>(remoteUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const [kind, email] of Object.entries(emails) as Array<[keyof typeof emails, string]>) {
      const result = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Prueba ${kind}` },
      });
      if (result.error) throw result.error;
      userIds[kind] = result.data.user.id;
    }

    const signedIn = async (email: string) => {
      const client = createClient<Database>(remoteUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      return client;
    };
    [teacher, studentA, studentB, studentC, outsider] = await Promise.all([
      signedIn(emails.teacher),
      signedIn(emails.studentA),
      signedIn(emails.studentB),
      signedIn(emails.studentC),
      signedIn(emails.outsider),
    ]);

    const organization = await admin
      .from("organizations")
      .insert({ name: `Organización B2 ${runId}`, created_by: userIds.teacher })
      .select("id")
      .single();
    if (organization.error) throw organization.error;
    organizationId = organization.data.id;

    const classroom = await admin
      .from("classrooms")
      .insert({
        organization_id: organizationId,
        title: `Aula B2 ${runId}`,
        owner_id: userIds.teacher,
        term: "Prueba",
      })
      .select("id")
      .single();
    if (classroom.error) throw classroom.error;
    classroomId = classroom.data.id;

    const memberships = await admin.from("class_members").insert([
      { classroom_id: classroomId, user_id: userIds.studentA, invited_by: userIds.teacher },
      { classroom_id: classroomId, user_id: userIds.studentB, invited_by: userIds.teacher },
      { classroom_id: classroomId, user_id: userIds.studentC, invited_by: userIds.teacher },
    ]);
    if (memberships.error) throw memberships.error;

    const groups = await admin
      .from("study_groups")
      .insert([
        { classroom_id: classroomId, name: `Grupo A ${runId}`, created_by: userIds.teacher },
        { classroom_id: classroomId, name: `Grupo B ${runId}`, created_by: userIds.teacher },
      ])
      .select("id, name");
    if (groups.error) throw groups.error;
    groupAId = groups.data.find((group) => group.name.startsWith("Grupo A"))?.id ?? null;
    groupBId = groups.data.find((group) => group.name.startsWith("Grupo B"))?.id ?? null;
    if (!groupAId || !groupBId) throw new Error("Remote groups were not created.");

    const groupMembers = await admin.from("group_members").insert([
      { group_id: groupAId, user_id: userIds.studentA, added_by: userIds.teacher },
      { group_id: groupAId, user_id: userIds.studentC, added_by: userIds.teacher },
      { group_id: groupBId, user_id: userIds.studentB, added_by: userIds.teacher },
    ]);
    if (groupMembers.error) throw groupMembers.error;
  }, 60_000);

  afterAll(async () => {
    if (!remoteConfigured || !admin) return;
    if (classroomId) {
      const documents = await admin.from("documents").select("storage_path").eq("classroom_id", classroomId);
      for (const document of documents.data ?? []) storagePaths.add(document.storage_path);
    }
    if (storagePaths.size) {
      await admin.storage.from("fontex-documents").remove([...storagePaths]);
    }
    if (classroomId) {
      await admin.from("documents").delete().eq("classroom_id", classroomId);
      await admin.from("study_groups").delete().eq("classroom_id", classroomId);
      await admin.from("class_members").delete().eq("classroom_id", classroomId);
      await admin.from("classrooms").delete().eq("id", classroomId);
    }
    if (organizationId) await admin.from("organizations").delete().eq("id", organizationId);
    await Promise.all(Object.values(userIds).filter(Boolean).map((userId) => admin.auth.admin.deleteUser(userId)));
  }, 60_000);

  async function uploadPdf(client: SupabaseClient<Database>, ownerId: string, filename: string) {
    if (!classroomId) throw new Error("Missing classroom.");
    const bytes = createSelectablePdf();
    const digest = await sha256(bytes);
    const reservation = await client.rpc("reserve_document_upload", {
      target_classroom_id: classroomId,
      document_title: filename.replace(/[.]pdf$/, ""),
      source_filename: filename,
      source_mime_type: "application/pdf",
      source_size_bytes: bytes.byteLength,
      source_page_count: 1,
      source_sha256: digest,
    });
    expect(reservation.error).toBeNull();
    if (!reservation.data || typeof reservation.data !== "object" || Array.isArray(reservation.data)) {
      throw new Error("Invalid reservation response.");
    }
    const documentId = reservation.data.document_id;
    if (typeof documentId !== "string") throw new Error("Missing document id.");
    const form = new FormData();
    form.set("documentId", documentId);
    form.set("file", new File([bytes], filename, { type: "application/pdf" }), filename);
    const uploaded = await client.functions.invoke("document-upload", { body: form, timeout: 60_000 });
    expect(uploaded.error).toBeNull();

    const document = await client
      .from("documents")
      .select("id, owner_id, classroom_id, storage_path, status")
      .eq("id", documentId)
      .single();
    expect(document.error).toBeNull();
    expect(document.data?.owner_id).toBe(ownerId);
    expect(document.data?.status).toBe("ready");
    if (!document.data) throw new Error("Uploaded document metadata missing.");
    storagePaths.add(document.data.storage_path);
    return document.data;
  }

  async function downloadWithRetry(client: SupabaseClient<Database>, path: string) {
    const download = () =>
      client.storage
        .from("fontex-documents")
        .download(path, { cacheNonce: crypto.randomUUID() }, { cache: "no-store" });
    let result = await download();
    for (let attempt = 0; result.error && attempt < 5; attempt += 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      result = await download();
    }
    return result;
  }

  it("enforces real private Storage, sharing, revocation, failure and deletion", async () => {
    if (!remoteUrl || !publishableKey || !classroomId || !groupAId) return;

    const privateDocument = await uploadPdf(studentA, userIds.studentA, "fontex-real.pdf");

    const ownDownload = await downloadWithRetry(studentA, privateDocument.storage_path);
    if (ownDownload.error) {
      const adminDownload = await downloadWithRetry(admin, privateDocument.storage_path);
      throw new Error(
        `Owner download failed (${ownDownload.error.statusCode ?? "unknown"}); ` +
          `admin download ${adminDownload.error ? `failed (${adminDownload.error.statusCode ?? "unknown"})` : "succeeded"}.`,
      );
    }
    expect(ownDownload.error).toBeNull();
    expect(ownDownload.data?.size).toBeGreaterThan(0);

    const studentBMetadata = await studentB.from("documents").select("id").eq("id", privateDocument.id);
    expect(studentBMetadata.data).toHaveLength(0);
    const studentBDownload = await studentB.storage.from("fontex-documents").download(privateDocument.storage_path);
    expect(studentBDownload.error).not.toBeNull();

    const teacherPrivateView = await teacher.from("documents").select("id").eq("id", privateDocument.id);
    expect(teacherPrivateView.data).toHaveLength(0);

    const directUpload = await studentA.storage
      .from("fontex-documents")
      .upload(`${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`, createSelectablePdf(), {
        contentType: "application/pdf",
      });
    expect(directUpload.error).not.toBeNull();

    const groupShare = await studentA
      .from("document_shares")
      .insert({ document_id: privateDocument.id, scope_type: "group", group_id: groupAId })
      .select("id")
      .single();
    expect(groupShare.error).toBeNull();
    if (!groupShare.data) throw new Error("Group share missing.");

    const studentCMetadata = await studentC.from("documents").select("id").eq("id", privateDocument.id);
    expect(studentCMetadata.data).toHaveLength(1);
    const studentCDownload = await downloadWithRetry(studentC, privateDocument.storage_path);
    expect(studentCDownload.error).toBeNull();
    expect((await studentB.from("documents").select("id").eq("id", privateDocument.id)).data).toHaveLength(0);

    const revoked = await studentA.from("document_shares").delete().eq("id", groupShare.data.id);
    expect(revoked.error).toBeNull();
    expect((await studentC.from("documents").select("id").eq("id", privateDocument.id)).data).toHaveLength(0);
    expect((await downloadWithRetry(studentC, privateDocument.storage_path)).error).not.toBeNull();

    const classroomDocument = await uploadPdf(teacher, userIds.teacher, "material-aula.pdf");
    const classroomShare = await teacher.from("document_shares").insert({
      document_id: classroomDocument.id,
      scope_type: "classroom",
      classroom_id: classroomId,
    });
    expect(classroomShare.error).toBeNull();
    expect((await studentA.from("documents").select("id").eq("id", classroomDocument.id)).data).toHaveLength(1);
    expect((await outsider.from("documents").select("id").eq("id", classroomDocument.id)).data).toHaveLength(0);
    expect((await outsider.storage.from("fontex-documents").download(classroomDocument.storage_path)).error).not.toBeNull();

    const reShare = await studentA.from("document_shares").insert({
      document_id: privateDocument.id,
      scope_type: "group",
      group_id: groupAId,
    });
    expect(reShare.error).toBeNull();
    const removed = await teacher.rpc("remove_classroom_member", {
      target_classroom_id: classroomId,
      target_user_id: userIds.studentC,
    });
    expect(removed.error).toBeNull();
    expect((await studentC.from("documents").select("id")).data).toHaveLength(0);
    expect((await studentC.storage.from("fontex-documents").download(privateDocument.storage_path)).error).not.toBeNull();

    const badBytes = new TextEncoder().encode("NOT-A-PDF\n%%EOF\n");
    const badReservation = await studentA.rpc("reserve_document_upload", {
      target_classroom_id: classroomId,
      document_title: "Firma falsa",
      source_filename: "firma-falsa.pdf",
      source_mime_type: "application/pdf",
      source_size_bytes: badBytes.byteLength,
      source_page_count: 1,
      source_sha256: await sha256(badBytes),
    });
    expect(badReservation.error).toBeNull();
    if (!badReservation.data || typeof badReservation.data !== "object" || Array.isArray(badReservation.data)) {
      throw new Error("Invalid failed reservation response.");
    }
    const badDocumentId = badReservation.data.document_id;
    const badPath = badReservation.data.storage_path;
    if (typeof badDocumentId !== "string" || typeof badPath !== "string") throw new Error("Bad reservation identifiers missing.");
    const badForm = new FormData();
    badForm.set("documentId", badDocumentId);
    badForm.set("file", new File([badBytes], "firma-falsa.pdf", { type: "application/pdf" }));
    const badUpload = await studentA.functions.invoke("document-upload", { body: badForm, timeout: 60_000 });
    expect(badUpload.error).not.toBeNull();
    const failedMetadata = await studentA.from("documents").select("status").eq("id", badDocumentId).single();
    expect(failedMetadata.data?.status).toBe("failed");
    expect((await studentA.storage.from("fontex-documents").download(badPath)).error).not.toBeNull();

    const publicUrl = studentA.storage.from("fontex-documents").getPublicUrl(privateDocument.storage_path).data.publicUrl;
    const publicResponse = await fetch(publicUrl);
    expect(publicResponse.ok).toBe(false);

    const anonymous = createClient<Database>(remoteUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    expect((await anonymous.from("documents").select("id")).error).not.toBeNull();
    expect((await anonymous.storage.from("fontex-documents").download(privateDocument.storage_path)).error).not.toBeNull();

    const deleted = await studentA.functions.invoke("document-delete", {
      body: { documentId: privateDocument.id },
      timeout: 45_000,
    });
    expect(deleted.error).toBeNull();
    expect((await admin.from("documents").select("id").eq("id", privateDocument.id)).data).toHaveLength(0);
    expect((await admin.storage.from("fontex-documents").download(privateDocument.storage_path)).error).not.toBeNull();
    storagePaths.delete(privateDocument.storage_path);
  }, 120_000);
});
