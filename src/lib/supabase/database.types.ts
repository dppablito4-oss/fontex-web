export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ClassroomRole = "teacher" | "student";
export type MembershipStatus = "active" | "removed";

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; created_at: string; updated_at: string };
        Insert: { id: string; display_name: string; created_at?: string; updated_at?: string };
        Update: { display_name?: string; updated_at?: string };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: { name?: string; updated_at?: string };
        Relationships: Relationship[];
      };
      classrooms: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          term: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          term?: string | null;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: { title?: string; term?: string | null; updated_at?: string };
        Relationships: Relationship[];
      };
      class_members: {
        Row: {
          classroom_id: string;
          user_id: string;
          role: ClassroomRole;
          status: MembershipStatus;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          classroom_id: string;
          user_id: string;
          role?: ClassroomRole;
          status?: MembershipStatus;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: ClassroomRole;
          status?: MembershipStatus;
          invited_by?: string | null;
          updated_at?: string;
        };
        Relationships: Relationship[];
      };
      classroom_invitations: {
        Row: {
          id: string;
          classroom_id: string;
          invited_email: string;
          role: ClassroomRole;
          token_hash: string;
          created_by: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: Relationship[];
      };
      study_groups: {
        Row: {
          id: string;
          classroom_id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          name: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: { name?: string; updated_at?: string };
        Relationships: Relationship[];
      };
      group_members: {
        Row: { group_id: string; user_id: string; added_by: string; created_at: string };
        Insert: { group_id: string; user_id: string; added_by?: string; created_at?: string };
        Update: never;
        Relationships: Relationship[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_workspace: {
        Args: {
          organization_name: string;
          classroom_title: string;
          classroom_term?: string | null;
        };
        Returns: string;
      };
      accept_classroom_invitation: {
        Args: { invitation_token: string };
        Returns: string;
      };
      create_classroom_invitation: {
        Args: {
          target_classroom_id: string;
          target_email: string;
          target_role?: ClassroomRole;
          valid_for?: string;
        };
        Returns: Json;
      };
      remove_classroom_member: {
        Args: { target_classroom_id: string; target_user_id: string };
        Returns: undefined;
      };
      revoke_classroom_invitation: {
        Args: { target_invitation_id: string };
        Returns: undefined;
      };
      set_classroom_member_role: {
        Args: {
          target_classroom_id: string;
          target_user_id: string;
          target_role: ClassroomRole;
        };
        Returns: undefined;
      };
    };
    Enums: {
      classroom_role: ClassroomRole;
      membership_status: MembershipStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
