export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          active_loans: number | null
          created_at: string | null
          id: string
          location: string
          name: string
          staff_count: number | null
          total_portfolio: number | null
          updated_at: string | null
        }
        Insert: {
          active_loans?: number | null
          created_at?: string | null
          id?: string
          location: string
          name: string
          staff_count?: number | null
          total_portfolio?: number | null
          updated_at?: string | null
        }
        Update: {
          active_loans?: number | null
          created_at?: string | null
          id?: string
          location?: string
          name?: string
          staff_count?: number | null
          total_portfolio?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          branch_id: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          employment_status: string | null
          first_name: string
          gender: string | null
          id: string
          id_number: string
          last_name: string
          monthly_income: number | null
          occupation: string | null
          phone: string
          photo_url: string | null
          region: string | null
          registration_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          employment_status?: string | null
          first_name: string
          gender?: string | null
          id?: string
          id_number: string
          last_name: string
          monthly_income?: number | null
          occupation?: string | null
          phone: string
          photo_url?: string | null
          region?: string | null
          registration_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          employment_status?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          id_number?: string
          last_name?: string
          monthly_income?: number | null
          occupation?: string | null
          phone?: string
          photo_url?: string | null
          region?: string | null
          registration_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_documents: {
        Row: {
          created_at: string
          document_type: string
          file_path: string
          id: string
          loan_id: string
          name: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_path: string
          id?: string
          loan_id: string
          name: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_path?: string
          id?: string
          loan_id?: string
          name?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      loan_portfolio_analysis: {
        Row: {
          amount_at_risk: number
          current_percentage: number
          date: string
          id: string
          par_1_30_percentage: number
          par_31_60_percentage: number
          par_61_90_percentage: number
          par_90_plus_percentage: number
          total_portfolio: number
        }
        Insert: {
          amount_at_risk: number
          current_percentage: number
          date: string
          id?: string
          par_1_30_percentage: number
          par_31_60_percentage: number
          par_61_90_percentage: number
          par_90_plus_percentage: number
          total_portfolio: number
        }
        Update: {
          amount_at_risk?: number
          current_percentage?: number
          date?: string
          id?: string
          par_1_30_percentage?: number
          par_31_60_percentage?: number
          par_61_90_percentage?: number
          par_90_plus_percentage?: number
          total_portfolio?: number
        }
        Relationships: []
      }
      loan_products: {
        Row: {
          amount_max: number
          amount_min: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          interest_rate: number
          name: string
          status: string
          term_max: number
          term_min: number
          term_unit: string
          updated_at: string
        }
        Insert: {
          amount_max: number
          amount_min: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interest_rate: number
          name: string
          status?: string
          term_max: number
          term_min: number
          term_unit: string
          updated_at?: string
        }
        Update: {
          amount_max?: number
          amount_min?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interest_rate?: number
          name?: string
          status?: string
          term_max?: number
          term_min?: number
          term_unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      loan_schedule: {
        Row: {
          created_at: string
          due_date: string
          id: string
          interest_due: number
          loan_id: string
          principal_due: number
          status: string
          total_due: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          interest_due: number
          loan_id: string
          principal_due: number
          status?: string
          total_due: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          interest_due?: number
          loan_id?: string
          principal_due?: number
          status?: string
          total_due?: number
          updated_at?: string
        }
        Relationships: []
      }
      loan_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          loan_id: string
          notes: string | null
          payment_method: string | null
          receipt_number: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          loan_id: string
          notes?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          loan_id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          amount: number
          balance: number
          client: string
          created_at: string | null
          date: string
          id: string
          loan_number: string | null
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          balance: number
          client: string
          created_at?: string | null
          date?: string
          id?: string
          loan_number?: string | null
          status: string
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          balance?: number
          client?: string
          created_at?: string | null
          date?: string
          id?: string
          loan_number?: string | null
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_loan_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["user_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "admin" | "loan_officer" | "data_entry"
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
  public: {
    Enums: {
      user_role: ["admin", "loan_officer", "data_entry"],
    },
  },
} as const
