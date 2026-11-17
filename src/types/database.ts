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
      brands: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      charge_types: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          due_date_type: string | null
          frequency: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          due_date_type?: string | null
          frequency?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          due_date_type?: string | null
          frequency?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      charges: {
        Row: {
          amount: number
          charge_type_id: number
          created_at: string | null
          id: number
          notes: string | null
          updated_at: string | null
          vehicle_id: number
        }
        Insert: {
          amount: number
          charge_type_id: number
          created_at?: string | null
          id?: number
          notes?: string | null
          updated_at?: string | null
          vehicle_id: number
        }
        Update: {
          amount?: number
          charge_type_id?: number
          created_at?: string | null
          id?: number
          notes?: string | null
          updated_at?: string | null
          vehicle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "charges_charge_type_id_fkey"
            columns: ["charge_type_id"]
            isOneToOne: false
            referencedRelation: "charge_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_types: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          added_count: number | null
          created_at: string | null
          error_details: Json | null
          failed_count: number | null
          filename: string | null
          id: number
          total_rows: number | null
          updated_count: number | null
        }
        Insert: {
          added_count?: number | null
          created_at?: string | null
          error_details?: Json | null
          failed_count?: number | null
          filename?: string | null
          id?: number
          total_rows?: number | null
          updated_count?: number | null
        }
        Update: {
          added_count?: number | null
          created_at?: string | null
          error_details?: Json | null
          failed_count?: number | null
          filename?: string | null
          id?: number
          total_rows?: number | null
          updated_count?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_id: string | null
          created_at: string | null
          display_name: string | null
          email: string
          id: number
          permissions: string[] | null
          role: string | null
          username: string
        }
        Insert: {
          auth_id?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          id?: number
          permissions?: string[] | null
          role?: string | null
          username: string
        }
        Update: {
          auth_id?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: number
          permissions?: string[] | null
          role?: string | null
          username?: string
        }
        Relationships: []
      }
      vehicle_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      vehicle_types: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string
          brand_id: number | null
          category_id: number | null
          code: string
          created_at: string | null
          fuel_type: string
          fuel_type_id: number | null
          id: number
          notes: string | null
          ptac: number | null
          puissance_fiscale: number | null
          purchase_date: string
          registration_plate: string
          status: string | null
          type_id: number | null
          updated_at: string | null
          vehicle_type: string
          ww_plate: string | null
        }
        Insert: {
          brand: string
          brand_id?: number | null
          category_id?: number | null
          code: string
          created_at?: string | null
          fuel_type: string
          fuel_type_id?: number | null
          id?: number
          notes?: string | null
          ptac?: number | null
          puissance_fiscale?: number | null
          purchase_date: string
          registration_plate: string
          status?: string | null
          type_id?: number | null
          updated_at?: string | null
          vehicle_type: string
          ww_plate?: string | null
        }
        Update: {
          brand?: string
          brand_id?: number | null
          category_id?: number | null
          code?: string
          created_at?: string | null
          fuel_type?: string
          fuel_type_id?: number | null
          id?: number
          notes?: string | null
          ptac?: number | null
          puissance_fiscale?: number | null
          purchase_date?: string
          registration_plate?: string
          status?: string | null
          type_id?: number | null
          updated_at?: string | null
          vehicle_type?: string
          ww_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vehicle_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_fuel_type_id_fkey"
            columns: ["fuel_type_id"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vehicle_summary: {
        Row: {
          brand: string | null
          brand_id: number | null
          brand_name: string | null
          category_id: number | null
          category_name: string | null
          charge_count: number | null
          code: string | null
          fuel_type: string | null
          fuel_type_id: number | null
          fuel_type_name: string | null
          id: number | null
          notes: string | null
          ptac: number | null
          puissance_fiscale: number | null
          purchase_date: string | null
          registration_plate: string | null
          status: string | null
          total_charges: number | null
          type_id: number | null
          type_name: string | null
          vehicle_type: string | null
          ww_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vehicle_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_fuel_type_id_fkey"
            columns: ["fuel_type_id"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_app_user: {
        Args: {
          p_display_name?: string
          p_email: string
          p_password: string
          p_permissions?: string[]
          p_role?: string
          p_username?: string
        }
        Returns: {
          auth_id: string
          created_at: string
          display_name: string
          email: string
          id: number
          permissions: string[]
          role: string
          username: string
        }[]
      }
      delete_app_user: { Args: { p_user_id: number }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      set_app_user_password: {
        Args: { p_new_password: string; p_user_id: number }
        Returns: boolean
      }
      update_own_profile: {
        Args: { p_display_name: string }
        Returns: {
          auth_id: string
          created_at: string
          display_name: string
          email: string
          id: number
          permissions: string[]
          role: string
          username: string
        }[]
      }
      user_has_permission: { Args: { p_scope: string }; Returns: boolean }
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

export const Constants = {
  public: {
    Enums: {},
  },
} as const