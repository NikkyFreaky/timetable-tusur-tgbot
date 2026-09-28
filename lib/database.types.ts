export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          email: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      bot_message_delivery_attempts: {
        Row: {
          chat_id: number
          created_at: string
          dispatch_id: string
          error: string | null
          id: number
          message_thread_id: number | null
          status: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          dispatch_id: string
          error?: string | null
          id?: never
          message_thread_id?: number | null
          status: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          dispatch_id?: string
          error?: string | null
          id?: never
          message_thread_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_message_delivery_attempts_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "bot_message_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_message_dispatches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          failed_count: number
          id: string
          kind: string
          sent_count: number
          text: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          kind: string
          sent_count?: number
          text?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          kind?: string
          sent_count?: number
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_message_dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_message_templates: {
        Row: {
          audience: string
          command: string
          text: string
          updated_at: string
        }
        Insert: {
          audience: string
          command: string
          text: string
          updated_at?: string
        }
        Update: {
          audience?: string
          command?: string
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      cache: {
        Row: {
          created_at: string | null
          expires_at: string
          key: string
          type: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          key: string
          type: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          key?: string
          type?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      chat_members: {
        Row: {
          added_at: string | null
          chat_id: number
          role: string
          updated_at: string | null
          user_id: number
        }
        Insert: {
          added_at?: string | null
          chat_id: number
          role: string
          updated_at?: string | null
          user_id: number
        }
        Update: {
          added_at?: string | null
          chat_id?: number
          role?: string
          updated_at?: string | null
          user_id?: number
        }
        Relationships: []
      }
      chat_topics: {
        Row: {
          chat_id: number
          created_at: string | null
          icon_color: number | null
          icon_custom_emoji_id: number | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string | null
          icon_color?: number | null
          icon_custom_emoji_id?: number | null
          id: number
          name: string
          updated_at?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string | null
          icon_color?: number | null
          icon_custom_emoji_id?: number | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_topics_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          bot_active: boolean
          created_at: string | null
          created_by: number | null
          id: number
          is_forum: boolean | null
          last_seen_at: string | null
          notification_state: Json | null
          photo_url: string | null
          settings: Json | null
          title: string | null
          topic_id: number | null
          type: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          bot_active?: boolean
          created_at?: string | null
          created_by?: number | null
          id: number
          is_forum?: boolean | null
          last_seen_at?: string | null
          notification_state?: Json | null
          photo_url?: string | null
          settings?: Json | null
          title?: string | null
          topic_id?: number | null
          type: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          bot_active?: boolean
          created_at?: string | null
          created_by?: number | null
          id?: number
          is_forum?: boolean | null
          last_seen_at?: string | null
          notification_state?: Json | null
          photo_url?: string | null
          settings?: Json | null
          title?: string | null
          topic_id?: number | null
          type?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_notification_claims: {
        Row: {
          claimed_at: string
          dispatch_key: string
          notification_type: string
          recipient_id: number
          recipient_kind: string
        }
        Insert: {
          claimed_at?: string
          dispatch_key: string
          notification_type: string
          recipient_id: number
          recipient_kind: string
        }
        Update: {
          claimed_at?: string
          dispatch_key?: string
          notification_type?: string
          recipient_id?: number
          recipient_kind?: string
        }
        Relationships: []
      }
      user_change_history: {
        Row: {
          changes: Json
          created_at: string | null
          id: number
          type: string
          user_id: number
        }
        Insert: {
          changes?: Json
          created_at?: string | null
          id?: number
          type: string
          user_id: number
        }
        Update: {
          changes?: Json
          created_at?: string | null
          id?: number
          type?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_change_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          first_seen_at: string
          id: string
          label: string
          language: string | null
          last_seen_at: string
          platform: string | null
          settings: Json | null
          tg_platform: string | null
          tg_version: string | null
          timezone: string | null
          user_agent: string | null
          user_id: number
        }
        Insert: {
          first_seen_at: string
          id: string
          label: string
          language?: string | null
          last_seen_at: string
          platform?: string | null
          settings?: Json | null
          tg_platform?: string | null
          tg_version?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id: number
        }
        Update: {
          first_seen_at?: string
          id?: string
          label?: string
          language?: string | null
          last_seen_at?: string
          platform?: string | null
          settings?: Json | null
          tg_platform?: string | null
          tg_version?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_login_history: {
        Row: {
          created_at: string | null
          device_id: string | null
          id: number
          ip: string | null
          user_id: number
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          id?: number
          ip?: string | null
          user_id: number
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          id?: number
          ip?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          added_to_attachment_menu: boolean | null
          allows_write_to_pm: boolean | null
          bot_active: boolean
          created_at: string | null
          first_name: string
          id: number
          is_bot: boolean | null
          is_premium: boolean | null
          language_code: string | null
          last_name: string | null
          last_seen_at: string | null
          notification_state: Json | null
          photo_url: string | null
          settings: Json | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          added_to_attachment_menu?: boolean | null
          allows_write_to_pm?: boolean | null
          bot_active?: boolean
          created_at?: string | null
          first_name: string
          id: number
          is_bot?: boolean | null
          is_premium?: boolean | null
          language_code?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          notification_state?: Json | null
          photo_url?: string | null
          settings?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          added_to_attachment_menu?: boolean | null
          allows_write_to_pm?: boolean | null
          bot_active?: boolean
          created_at?: string | null
          first_name?: string
          id?: number
          is_bot?: boolean | null
          is_premium?: boolean | null
          language_code?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          notification_state?: Json | null
          photo_url?: string | null
          settings?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_superadmin: { Args: { check_user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
