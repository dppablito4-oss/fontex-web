import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../../lib/supabase/client";
import type { ClassroomRole } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/AuthProvider";

export type ClassroomSummary = {
  id: string;
  organizationId: string;
  title: string;
  term: string | null;
  ownerId: string;
};

export type ClassroomMember = {
  userId: string;
  displayName: string;
  role: ClassroomRole;
  status: "active" | "removed";
};

export type StudyGroup = {
  id: string;
  classroomId: string;
  name: string;
};

export type GroupMembership = {
  groupId: string;
  userId: string;
};

type InvitationResult = {
  invitationId: string;
  token: string;
};

type WorkspaceContextValue = {
  loading: boolean;
  error: string | null;
  classrooms: ClassroomSummary[];
  activeClassroom: ClassroomSummary | null;
  activeRole: ClassroomRole | null;
  members: ClassroomMember[];
  groups: StudyGroup[];
  groupMemberships: GroupMembership[];
  selectClassroom: (classroomId: string) => void;
  refresh: () => Promise<void>;
  createWorkspace: (organizationName: string, classroomTitle: string, term: string) => Promise<void>;
  createInvitation: (email: string, role: ClassroomRole) => Promise<InvitationResult>;
  acceptInvitation: (token: string) => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  addGroupMember: (groupId: string, userId: string) => Promise<void>;
  removeGroupMember: (groupId: string, userId: string) => Promise<void>;
  removeClassroomMember: (userId: string) => Promise<void>;
  setMemberRole: (userId: string, role: ClassroomRole) => Promise<void>;
};

const unavailable = () => Promise.reject(new Error("El espacio de trabajo no está disponible."));

const defaultContext: WorkspaceContextValue = {
  loading: false,
  error: null,
  classrooms: [],
  activeClassroom: null,
  activeRole: null,
  members: [],
  groups: [],
  groupMemberships: [],
  selectClassroom: () => undefined,
  refresh: unavailable,
  createWorkspace: unavailable,
  createInvitation: async () => {
    await unavailable();
    return { invitationId: "", token: "" };
  },
  acceptInvitation: unavailable,
  createGroup: unavailable,
  addGroupMember: unavailable,
  removeGroupMember: unavailable,
  removeClassroomMember: unavailable,
  setMemberRole: unavailable,
};

const WorkspaceContext = createContext<WorkspaceContextValue>(defaultContext);

function readableDataError(message: string) {
  if (message.includes("row-level security")) return "No tienes permiso para realizar esa acción.";
  if (message.includes("duplicate key")) return "Ese registro ya existe.";
  return message;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [loading, setLoading] = useState(status === "authenticated");
  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);
  const [members, setMembers] = useState<ClassroomMember[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([]);

  const activeClassroom = classrooms.find((item) => item.id === activeClassroomId) ?? null;
  const activeRole =
    members.find((member) => member.userId === user?.id && member.status === "active")?.role ?? null;

  const loadDetails = useCallback(async (classroomId: string | null) => {
    if (!supabase || !classroomId) {
      setMembers([]);
      setGroups([]);
      setGroupMemberships([]);
      return;
    }

    const [membersResult, groupsResult] = await Promise.all([
      supabase
        .from("class_members")
        .select("user_id, role, status")
        .eq("classroom_id", classroomId)
        .eq("status", "active"),
      supabase
        .from("study_groups")
        .select("id, classroom_id, name")
        .eq("classroom_id", classroomId)
        .order("name"),
    ]);

    if (membersResult.error) throw new Error(readableDataError(membersResult.error.message));
    if (groupsResult.error) throw new Error(readableDataError(groupsResult.error.message));

    const userIds = membersResult.data.map((membership) => membership.user_id);
    const profileResult = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [], error: null };

    if (profileResult.error) throw new Error(readableDataError(profileResult.error.message));

    const names = new Map(profileResult.data.map((profile) => [profile.id, profile.display_name]));
    setMembers(
      membersResult.data.map((membership) => ({
        userId: membership.user_id,
        displayName: names.get(membership.user_id) ?? "Usuario",
        role: membership.role,
        status: membership.status,
      })),
    );

    const nextGroups = groupsResult.data.map((group) => ({
      id: group.id,
      classroomId: group.classroom_id,
      name: group.name,
    }));
    setGroups(nextGroups);

    if (!nextGroups.length) {
      setGroupMemberships([]);
      return;
    }

    const membershipResult = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", nextGroups.map((group) => group.id));
    if (membershipResult.error) throw new Error(readableDataError(membershipResult.error.message));
    setGroupMemberships(
      membershipResult.data.map((membership) => ({
        groupId: membership.group_id,
        userId: membership.user_id,
      })),
    );
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase || status !== "authenticated") return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: classroomsError } = await supabase
        .from("classrooms")
        .select("id, organization_id, title, term, owner_id")
        .order("created_at");
      if (classroomsError) throw new Error(readableDataError(classroomsError.message));

      const nextClassrooms = data.map((classroom) => ({
        id: classroom.id,
        organizationId: classroom.organization_id,
        title: classroom.title,
        term: classroom.term,
        ownerId: classroom.owner_id,
      }));
      setClassrooms(nextClassrooms);

      const nextActiveId = nextClassrooms.some((item) => item.id === activeClassroomId)
        ? activeClassroomId
        : (nextClassrooms[0]?.id ?? null);
      setActiveClassroomId(nextActiveId);
      await loadDetails(nextActiveId);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "No fue posible cargar el aula.");
    } finally {
      setLoading(false);
    }
  }, [activeClassroomId, loadDetails, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh, status, user?.id]);

  const runMutation = useCallback(async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "No fue posible guardar el cambio.";
      setError(message);
      throw new Error(message, { cause: mutationError });
    }
  }, [refresh]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      loading,
      error,
      classrooms,
      activeClassroom,
      activeRole,
      members,
      groups,
      groupMemberships,
      selectClassroom(classroomId) {
        setActiveClassroomId(classroomId);
        setLoading(true);
        void loadDetails(classroomId)
          .catch((detailError: unknown) => {
            setError(detailError instanceof Error ? detailError.message : "No fue posible cargar el aula.");
          })
          .finally(() => setLoading(false));
      },
      refresh,
      async createWorkspace(organizationName, classroomTitle, term) {
        if (!supabase) return unavailable();
        const client = supabase;
        await runMutation(async () => {
          const { error: workspaceError } = await client.rpc("create_workspace", {
            organization_name: organizationName.trim(),
            classroom_title: classroomTitle.trim(),
            classroom_term: term.trim() || null,
          });
          if (workspaceError) throw new Error(readableDataError(workspaceError.message));
        });
      },
      async createInvitation(email, role) {
        if (!supabase || !activeClassroom) return unavailable();
        setError(null);
        const { data, error: invitationError } = await supabase.rpc("create_classroom_invitation", {
          target_classroom_id: activeClassroom.id,
          target_email: email.trim(),
          target_role: role,
        });
        if (invitationError) {
          const message = readableDataError(invitationError.message);
          setError(message);
          throw new Error(message);
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Supabase devolvió una invitación inválida.");
        }
        const invitationId = data.invitation_id;
        const token = data.token;
        if (typeof invitationId !== "string" || typeof token !== "string") {
          throw new Error("Supabase devolvió una invitación incompleta.");
        }
        return { invitationId, token };
      },
      async acceptInvitation(token) {
        if (!supabase) return unavailable();
        const client = supabase;
        await runMutation(async () => {
          const { error: invitationError } = await client.rpc("accept_classroom_invitation", {
            invitation_token: token.trim(),
          });
          if (invitationError) throw new Error(readableDataError(invitationError.message));
        });
      },
      async createGroup(name) {
        if (!supabase || !activeClassroom) return unavailable();
        const client = supabase;
        await runMutation(async () => {
          const { error: groupError } = await client.from("study_groups").insert({
            classroom_id: activeClassroom.id,
            name: name.trim(),
          });
          if (groupError) throw new Error(readableDataError(groupError.message));
        });
      },
      async addGroupMember(groupId, userId) {
        if (!supabase) return unavailable();
        const client = supabase;
        await runMutation(async () => {
          const { error: memberError } = await client
            .from("group_members")
            .insert({ group_id: groupId, user_id: userId });
          if (memberError) throw new Error(readableDataError(memberError.message));
        });
      },
      async removeGroupMember(groupId, userId) {
        if (!supabase) return unavailable();
        const client = supabase;
        await runMutation(async () => {
          const { error: memberError } = await client
            .from("group_members")
            .delete()
            .eq("group_id", groupId)
            .eq("user_id", userId);
          if (memberError) throw new Error(readableDataError(memberError.message));
        });
      },
      async removeClassroomMember(userId) {
        if (!supabase || !activeClassroom) return unavailable();
        const client = supabase;
        await runMutation(async () => {
          const { error: memberError } = await client.rpc("remove_classroom_member", {
            target_classroom_id: activeClassroom.id,
            target_user_id: userId,
          });
          if (memberError) throw new Error(readableDataError(memberError.message));
        });
      },
      async setMemberRole(userId, role) {
        if (!supabase || !activeClassroom) return unavailable();
        const client = supabase;
        await runMutation(async () => {
          const { error: memberError } = await client.rpc("set_classroom_member_role", {
            target_classroom_id: activeClassroom.id,
            target_user_id: userId,
            target_role: role,
          });
          if (memberError) throw new Error(readableDataError(memberError.message));
        });
      },
    }),
    [
      activeClassroom,
      activeRole,
      classrooms,
      error,
      groupMemberships,
      groups,
      loading,
      members,
      refresh,
      loadDetails,
      runMutation,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  return useContext(WorkspaceContext);
}
