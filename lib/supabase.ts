import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: number
          first_name: string
          last_name: string | null
          username: string | null
          photo_url: string | null
          language_code: string | null
          is_premium: boolean | null
          added_to_attachment_menu: boolean | null
          allows_write_to_pm: boolean | null
          is_bot: boolean | null
          settings: Record<string, unknown> | null
          notification_state: Record<string, unknown>
          created_at: string
          updated_at: string
          last_seen_at: string
        }
        Insert: {
          id: number
          first_name: string
          last_name?: string | null
          username?: string | null
          photo_url?: string | null
          language_code?: string | null
          is_premium?: boolean | null
          added_to_attachment_menu?: boolean | null
          allows_write_to_pm?: boolean | null
          is_bot?: boolean | null
          settings?: Record<string, unknown> | null
          notification_state?: Record<string, unknown>
          created_at?: string
          updated_at?: string
          last_seen_at?: string
        }
        Update: {
          id?: number
          first_name?: string
          last_name?: string | null
          username?: string | null
          photo_url?: string | null
          language_code?: string | null
          is_premium?: boolean | null
          added_to_attachment_menu?: boolean | null
          allows_write_to_pm?: boolean | null
          is_bot?: boolean | null
          settings?: Record<string, unknown> | null
          notification_state?: Record<string, unknown>
          created_at?: string
          updated_at?: string
          last_seen_at?: string
        }
      }
      chats: {
        Row: {
          id: number
          type: string
          title: string | null
          username: string | null
          photo_url: string | null
          settings: Record<string, unknown> | null
          notification_state: Record<string, unknown>
          created_at: string
          updated_at: string
          last_seen_at: string
        }
        Insert: {
          id: number
          type: string
          title?: string | null
          username?: string | null
          photo_url?: string | null
          settings?: Record<string, unknown> | null
          notification_state?: Record<string, unknown>
          created_at?: string
          updated_at?: string
          last_seen_at?: string
        }
        Update: {
          id?: number
          type?: string
          title?: string | null
          username?: string | null
          photo_url?: string | null
          settings?: Record<string, unknown> | null
          notification_state?: Record<string, unknown>
          created_at?: string
          updated_at?: string
          last_seen_at?: string
        }
      }
      user_devices: {
        Row: {
          id: string
          user_id: number
          label: string
          tg_platform: string | null
          tg_version: string | null
          user_agent: string | null
          platform: string | null
          language: string | null
          timezone: string | null
          first_seen_at: string
          last_seen_at: string
          settings: Record<string, unknown> | null
        }
        Insert: {
          id: string
          user_id: number
          label: string
          tg_platform?: string | null
          tg_version?: string | null
          user_agent?: string | null
          platform?: string | null
          language?: string | null
          timezone?: string | null
          first_seen_at: string
          last_seen_at: string
          settings?: Record<string, unknown> | null
        }
        Update: {
          id?: string
          user_id?: number
          label?: string
          tg_platform?: string | null
          tg_version?: string | null
          user_agent?: string | null
          platform?: string | null
          language?: string | null
          timezone?: string | null
          first_seen_at?: string
          last_seen_at?: string
          settings?: Record<string, unknown> | null
        }
      }
      cache: {
        Row: {
          key: string
          value: Record<string, unknown>
          type: string
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          key: string
          value: Record<string, unknown>
          type: string
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Record<string, unknown>
          type?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
