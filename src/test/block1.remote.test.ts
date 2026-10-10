import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import process from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../lib/supabase/database.types";

const remoteUrl = process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.service_role;
const remoteConfigured = Boolean(remoteUrl && publishableKey && serviceRoleKey);

const suite = describe.runIf(remoteConfigured);

suite("Block 1 remote RLS", () => {
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Fontex-${crypto.randomUUID()}-Aa1!`;
  const emails = {
    teacher: `teacher-${runId}@fontex.test`,
    student: `student-${runId}@fontex.test`,
    outsider: `outsider-${runId}@fontex.test`,
  };
  const userIds: string[] = [];
  let organizationId: string | null = null;
  let classroomId: string | null = null;
  let groupId: string | null = null;
  let admin: SupabaseClient<Database>;
  let teacher: SupabaseClient<Database>;
  let student: SupabaseClient<Database>;
  let outsider: SupabaseClient<Database>;

  beforeAll(async () => {
    if (!remoteUrl || !publishableKey || !serviceRoleKey) return;

    admin = createClient<Database>(remoteUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const [kind, email] of Object.entries(emails)) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Prueba ${kind}` },
      });
      if (error) throw error;
      userIds.push(data.user.id);
    }

    const authenticatedClient = async (email: string) => {
      const client = createClient<Database>(remoteUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return client;
    };

    [teacher, student, outsider] = await Promise.all([
      authenticatedClient(emails.teacher),
      authenticatedClient(emails.student),
      authenticatedClient(emails.outsider),
    ]);
  }, 30_000);

  afterAll(async () => {
    if (!remoteConfigured || !admin) return;

    if (groupId) await admin.from("group_members").delete().eq("group_id", groupId);
    if (classroomId) {
      await admin.from("classroom_invitations").delete().eq("classroom_id", classroomId);
      await admin.from("study_groups").delete().eq("classroom_id", classroomId);
      await admin.from("class_members").delete().eq("classroom_id", classroomId);
      await admin.from("classrooms").delete().eq("id", classroomId);
    }
    if (organizationId) await admin.from("organizations").delete().eq("id", organizationId);
    await Promise.all(userIds.map((userId) => admin.auth.admin.deleteUser(userId)));
  }, 30_000);

  it("enforces invitation, role, classroom and group isolation", async () => {
    const existingOrg = await admin.from("organizations").select("id").limit(1).maybeSingle();
    let bootstrapClassroomId: string | null = null;
    if (existingOrg.data) {
      const bootstrap = await admin
        .from("classrooms")
        .insert({
          organization_id: existingOrg.data.id,
          title: `Bootstrap ${runId}`,
          owner_id: userIds[0]!,
        })
        .select("id")
        .single();
      if (bootstrap.data) bootstrapClassroomId = bootstrap.data.id;
    }

    const workspaceResult = await teacher.rpc("create_workspace", {
      organization_name: `Organización ${runId}`,
      classroom_title: `Aula ${runId}`,
      classroom_term: "Prueba",
    });
    if (bootstrapClassroomId) {
      await admin.from("classrooms").delete().eq("id", bootstrapClassroomId);
    }
    expect(workspaceResult.error).toBeNull();
    classroomId = workspaceResult.data;
    expect(classroomId).toBeTruthy();

    const organizationResult = await teacher
      .from("classrooms")
      .select("organization_id")
      .eq("id", classroomId as string)
      .single();
    expect(organizationResult.error).toBeNull();
    organizationId = organizationResult.data?.organization_id ?? null;
    expect(organizationId).toBeTruthy();

    const outsiderClassrooms = await outsider.from("classrooms").select("id");
    expect(outsiderClassrooms.error).toBeNull();
    expect(outsiderClassrooms.data).toHaveLength(0);

    const invitationResult = await teacher.rpc("create_classroom_invitation", {
      target_classroom_id: classroomId as string,
      target_email: emails.student,
      target_role: "student",
      valid_for: "1 day",
    });
    expect(invitationResult.error).toBeNull();
    if (!invitationResult.data || typeof invitationResult.data !== "object" || Array.isArray(invitationResult.data)) {
      throw new Error("Invitation RPC returned an invalid payload.");
    }
    const token = invitationResult.data.token;
    expect(typeof token).toBe("string");
    if (typeof token !== "string") throw new Error("Invitation token is missing.");

    const wrongAcceptance = await outsider.rpc("accept_classroom_invitation", {
      invitation_token: token,
    });
    expect(wrongAcceptance.error?.code).toBe("42501");

    const accepted = await student.rpc("accept_classroom_invitation", {
      invitation_token: token,
    });
    expect(accepted.error).toBeNull();
    expect(accepted.data).toBe(classroomId);

    const studentWorkspace = await student.rpc("create_workspace", {
      organization_name: `Organización indebida ${runId}`,
      classroom_title: `Aula indebida ${runId}`,
      classroom_term: "Prueba",
    });
    expect(studentWorkspace.error?.code).toBe("42501");

    const selfPromotion = await student
      .from("class_members")
      .update({ role: "teacher" })
      .eq("classroom_id", classroomId as string)
      .eq("user_id", userIds[1] as string);
    expect(selfPromotion.error?.code).toBe("42501");

    const groupResult = await teacher
      .from("study_groups")
      .insert({ classroom_id: classroomId as string, name: `Grupo ${runId}` })
      .select("id")
      .single();
    expect(groupResult.error).toBeNull();
    groupId = groupResult.data?.id ?? null;
    expect(groupId).toBeTruthy();

    const assignment = await teacher
      .from("group_members")
      .insert({ group_id: groupId as string, user_id: userIds[1] as string });
    expect(assignment.error).toBeNull();

    const outsiderGroups = await outsider.from("study_groups").select("id");
    expect(outsiderGroups.error).toBeNull();
    expect(outsiderGroups.data).toHaveLength(0);

    const studentAssignment = await student
      .from("group_members")
      .insert({ group_id: groupId as string, user_id: userIds[2] as string });
    expect(studentAssignment.error?.code).toBe("42501");

    const removal = await teacher
      .from("group_members")
      .delete()
      .eq("group_id", groupId as string)
      .eq("user_id", userIds[1] as string);
    expect(removal.error).toBeNull();

    const groupAfterRemoval = await teacher
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId as string);
    expect(groupAfterRemoval.data).toHaveLength(0);

    const classroomRemoval = await teacher.rpc("remove_classroom_member", {
      target_classroom_id: classroomId as string,
      target_user_id: userIds[1] as string,
    });
    expect(classroomRemoval.error).toBeNull();

    const studentClassrooms = await student.from("classrooms").select("id");
    expect(studentClassrooms.error).toBeNull();
    expect(studentClassrooms.data).toHaveLength(0);
  }, 30_000);
});
