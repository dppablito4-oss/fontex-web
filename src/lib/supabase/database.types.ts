export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ClassroomRole = "teacher" | "student";
export type MembershipStatus = "active" | "removed";
export type DocumentStatus = "pending" | "uploading" | "ready" | "failed";
export type DocumentShareScope = "group" | "classroom";

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
      document_limits: {
        Row: {
          id: number;
          max_file_bytes: number;
          max_pages: number;
          max_documents_per_user: number;
          max_bytes_per_user: number;
          max_bytes_per_classroom: number;
          max_bytes_global: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          owner_id: string;
          classroom_id: string;
          title: string;
          original_filename: string;
          mime_type: string;
          size_bytes: number;
          page_count: number;
          content_sha256: string;
          storage_path: string;
          status: DocumentStatus;
          failure_code: string | null;
          upload_expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: Relationship[];
      };
      document_shares: {
        Row: {
          id: string;
          document_id: string;
          scope_type: DocumentShareScope;
          classroom_id: string | null;
          group_id: string | null;
          granted_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          scope_type: DocumentShareScope;
          classroom_id?: string | null;
          group_id?: string | null;
          granted_by?: string;
          created_at?: string;
        };
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
      reserve_document_upload: {
        Args: {
          target_classroom_id: string;
          document_title: string;
          source_filename: string;
          source_mime_type: string;
          source_size_bytes: number;
          source_page_count: number;
          source_sha256: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      classroom_role: ClassroomRole;
      membership_status: MembershipStatus;
      document_status: DocumentStatus;
      document_share_scope: DocumentShareScope;
    };
    CompositeTypes: Record<string, never>;
  };
};
