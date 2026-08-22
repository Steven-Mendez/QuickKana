export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attempts: {
        Row: {
          answer: string
          client_created_at: string
          confused_with: string | null
          created_at: string
          expected: string
          id: string
          is_correct: boolean
          is_typo: boolean
          kana: string
          modality: Database["public"]["Enums"]["modality"]
          payload: Json | null
          response_ms: number
          session_id: string | null
          syllabary: Database["public"]["Enums"]["syllabary"]
          user_id: string
        }
        Insert: {
          answer: string
          client_created_at: string
          confused_with?: string | null
          created_at?: string
          expected: string
          id: string
          is_correct: boolean
          is_typo?: boolean
          kana: string
          modality: Database["public"]["Enums"]["modality"]
          payload?: Json | null
          response_ms: number
          session_id?: string | null
          syllabary: Database["public"]["Enums"]["syllabary"]
          user_id: string
        }
        Update: {
          answer?: string
          client_created_at?: string
          confused_with?: string | null
          created_at?: string
          expected?: string
          id?: string
          is_correct?: boolean
          is_typo?: boolean
          kana?: string
          modality?: Database["public"]["Enums"]["modality"]
          payload?: Json | null
          response_ms?: number
          session_id?: string | null
          syllabary?: Database["public"]["Enums"]["syllabary"]
          user_id?: string
        }
        Relationships: []
      }
      char_stats: {
        Row: {
          attempts: number
          best_streak: number
          correct: number
          kana: string
          last_seen_at: string | null
          streak: number
          total_ms: number
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          attempts?: number
          best_streak?: number
          correct?: number
          kana: string
          last_seen_at?: string | null
          streak?: number
          total_ms?: number
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          attempts?: number
          best_streak?: number
          correct?: number
          kana?: string
          last_seen_at?: string | null
          streak?: number
          total_ms?: number
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      confusion_groups: {
        Row: {
          activated_at: string
          graduated_at: string | null
          id: string
          members: string[]
          status: Database["public"]["Enums"]["group_status"]
          streak: number
          times_activated: number
          total_misses: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at: string
          graduated_at?: string | null
          id: string
          members: string[]
          status?: Database["public"]["Enums"]["group_status"]
          streak?: number
          times_activated?: number
          total_misses?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          graduated_at?: string | null
          id?: string
          members?: string[]
          status?: Database["public"]["Enums"]["group_status"]
          streak?: number
          times_activated?: number
          total_misses?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      confusion_pairs: {
        Row: {
          count: number
          kana_a: string
          kana_b: string
          last_at: string | null
          user_id: string
        }
        Insert: {
          count?: number
          kana_a: string
          kana_b: string
          last_at?: string | null
          user_id: string
        }
        Update: {
          count?: number
          kana_a?: string
          kana_b?: string
          last_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          imported_at: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          imported_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          imported_at?: string | null
        }
        Relationships: []
      }
      progression: {
        Row: {
          best_accuracy: number
          best_session_streak: number
          day_best: number
          day_last: string | null
          day_streak: number
          lesson_hiragana: number
          lesson_katakana: number
          mode: string
          track: Database["public"]["Enums"]["syllabary"]
          unlocked_at: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          best_accuracy?: number
          best_session_streak?: number
          day_best?: number
          day_last?: string | null
          day_streak?: number
          lesson_hiragana?: number
          lesson_katakana?: number
          mode?: string
          track?: Database["public"]["Enums"]["syllabary"]
          unlocked_at?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          best_accuracy?: number
          best_session_streak?: number
          day_best?: number
          day_last?: string | null
          day_streak?: number
          lesson_hiragana?: number
          lesson_katakana?: number
          mode?: string
          track?: Database["public"]["Enums"]["syllabary"]
          unlocked_at?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_batches: {
        Row: {
          applied_at: string
          id: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          id: string
          user_id: string
        }
        Update: {
          applied_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      typos: {
        Row: {
          count: number
          kana: string
          typo_text: string
          user_id: string
        }
        Insert: {
          count?: number
          kana: string
          typo_text: string
          user_id: string
        }
        Update: {
          count?: number
          kana?: string
          typo_text?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          selection: Json
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          selection?: Json
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          selection?: Json
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_totals: {
        Row: {
          reading_sessions: number
          updated_at: string
          user_id: string
          writing_sessions: number
        }
        Insert: {
          reading_sessions?: number
          updated_at?: string
          user_id: string
          writing_sessions?: number
        }
        Update: {
          reading_sessions?: number
          updated_at?: string
          user_id?: string
          writing_sessions?: number
        }
        Relationships: []
      }
      writing_char_stats: {
        Row: {
          attempts: number
          best_streak: number
          correct: number
          kana: string
          last_seen_at: string | null
          memory_correct: number
          streak: number
          stroke_mistakes: number
          total_ms: number
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          attempts?: number
          best_streak?: number
          correct?: number
          kana: string
          last_seen_at?: string | null
          memory_correct?: number
          streak?: number
          stroke_mistakes?: number
          total_ms?: number
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          attempts?: number
          best_streak?: number
          correct?: number
          kana?: string
          last_seen_at?: string | null
          memory_correct?: number
          streak?: number
          stroke_mistakes?: number
          total_ms?: number
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_user_data: { Args: never; Returns: Json }
      import_local_snapshot: { Args: { snapshot: Json }; Returns: Json }
      sync_push: {
        Args: { aggregates?: Json; batch_id: string; events?: Json }
        Returns: Json
      }
    }
    Enums: {
      group_status: "active" | "graduated"
      modality: "reading" | "writing"
      syllabary: "hiragana" | "katakana"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      group_status: ["active", "graduated"],
      modality: ["reading", "writing"],
      syllabary: ["hiragana", "katakana"],
    },
  },
} as const

