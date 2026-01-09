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
    PostgrestVersion: "13.0.5"
  }
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
      FilmRatings: {
        Row: {
          created_at: string
          film_slug: string
          rating: number
          rating_count: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          film_slug: string
          rating: number
          rating_count?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          film_slug?: string
          rating?: number
          rating_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      Films: {
        Row: {
          banner: string | null
          created_at: string
          film_slug: string
          lb_rating: number | null
          poster: string | null
          title: string | null
          tmdb_link: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          banner?: string | null
          created_at?: string
          film_slug: string
          lb_rating?: number | null
          poster?: string | null
          title?: string | null
          tmdb_link?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          banner?: string | null
          created_at?: string
          film_slug?: string
          lb_rating?: number | null
          poster?: string | null
          title?: string | null
          tmdb_link?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      MFLMovieData: {
        Row: {
          awards_points: number | null
          box_office_points: string | null
          critical_perf_points: string | null
          film_slug: string | null
          points_per_dollar: number | null
          price: number | null
          rosters: number | null
          title: string
          total_points: number | null
        }
        Insert: {
          awards_points?: number | null
          box_office_points?: string | null
          critical_perf_points?: string | null
          film_slug?: string | null
          points_per_dollar?: number | null
          price?: number | null
          rosters?: number | null
          title: string
          total_points?: number | null
        }
        Update: {
          awards_points?: number | null
          box_office_points?: string | null
          critical_perf_points?: string | null
          film_slug?: string | null
          points_per_dollar?: number | null
          price?: number | null
          rosters?: number | null
          title?: string
          total_points?: number | null
        }
        Relationships: []
      }
      MFLScoringMetrics: {
        Row: {
          category: string | null
          metric: string | null
          metric_id: number
          metric_name: string | null
          point_value: number | null
          scoring_condition: string | null
        }
        Insert: {
          category?: string | null
          metric?: string | null
          metric_id?: number
          metric_name?: string | null
          point_value?: number | null
          scoring_condition?: string | null
        }
        Update: {
          category?: string | null
          metric?: string | null
          metric_id?: number
          metric_name?: string | null
          point_value?: number | null
          scoring_condition?: string | null
        }
        Relationships: []
      }
      MFLScoringTally: {
        Row: {
          film_slug: string | null
          metric_id: number | null
          points_awarded: number | null
          scoring_id: number
        }
        Insert: {
          film_slug?: string | null
          metric_id?: number | null
          points_awarded?: number | null
          scoring_id?: number
        }
        Update: {
          film_slug?: string | null
          metric_id?: number | null
          points_awarded?: number | null
          scoring_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_metric_id"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "MFLScoringMetrics"
            referencedColumns: ["metric_id"]
          },
        ]
      }
      MFLUserMovies: {
        Row: {
          film_slug: string | null
          title: string
          username: string
        }
        Insert: {
          film_slug?: string | null
          title: string
          username: string
        }
        Update: {
          film_slug?: string | null
          title?: string
          username?: string
        }
        Relationships: []
      }
      UserFilms: {
        Row: {
          created_at: string
          film_slug: string
          lbusername: string
          liked: boolean | null
          rating: number | null
          title: string | null
          updated_at: string | null
          watched: string | null
        }
        Insert: {
          created_at?: string
          film_slug: string
          lbusername: string
          liked?: boolean | null
          rating?: number | null
          title?: string | null
          updated_at?: string | null
          watched?: string | null
        }
        Update: {
          created_at?: string
          film_slug?: string
          lbusername?: string
          liked?: boolean | null
          rating?: number | null
          title?: string | null
          updated_at?: string | null
          watched?: string | null
        }
        Relationships: []
      }
      UserRatings: {
        Row: {
          count: number | null
          created_at: string
          rating: number
          updated_at: string | null
          username: string
        }
        Insert: {
          count?: number | null
          created_at?: string
          rating: number
          updated_at?: string | null
          username: string
        }
        Update: {
          count?: number | null
          created_at?: string
          rating?: number
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      Users: {
        Row: {
          created_at: string
          display_name: string | null
          followers: number | null
          following: number | null
          is_discord: boolean | null
          lbusername: string
          number_of_lists: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          followers?: number | null
          following?: number | null
          is_discord?: boolean | null
          lbusername: string
          number_of_lists?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          followers?: number | null
          following?: number | null
          is_discord?: boolean | null
          lbusername?: string
          number_of_lists?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      WatchList: {
        Row: {
          created_at: string | null
          date_added: string
          id: number
          letterboxd_uri: string
          name: string
          updated_at: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          date_added: string
          id?: number
          letterboxd_uri: string
          name: string
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          date_added?: string
          id?: number
          letterboxd_uri?: string
          name?: string
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_user_films: {
        Args: never
        Returns: {
          film_slug: string
          title: string
        }[]
      }
      get_hater_rankings: {
        Args: never
        Returns: {
          differential: number
          display_name: string
          films_rated: number
          lbusername: string
          normalized: number
        }[]
      }
      get_mfl_movies: {
        Args: never
        Returns: {
          film_slug: string
          title: string
        }[]
      }
      get_missing_films: { Args: never; Returns: string[] }
      get_movie_swap: {
        Args: { user1: string; user2: string }
        Returns: {
          film_slug: string
          title: string
        }[]
      }
      get_rankings: {
        Args: never
        Returns: {
          differential: number
          lbusername: string
        }[]
      }
      get_rating_distribution_all: {
        Args: never
        Returns: {
          count: number
          rating: number
        }[]
      }
      get_user_films_count: { Args: never; Returns: number }
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
    Enums: {},
  },
} as const
