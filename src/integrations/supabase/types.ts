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
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          document_name: string
          document_type: string
          file_path: string
          id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          client_id: string
          created_at?: string
          document_name: string
          document_type: string
          file_path: string
          id?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          client_id?: string
          created_at?: string
          document_name?: string
          document_type?: string
          file_path?: string
          id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      client_draw_down_accounts: {
        Row: {
          balance: number
          client_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          client_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          client_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_draw_down_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_referees: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          phone: string
          relationship: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          phone: string
          relationship: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          branch_id: string | null
          business_photo_url: string | null
          city: string | null
          client_number: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          employment_status: string | null
          first_name: string
          gender: string | null
          id: string
          id_number: string
          id_photo_back_url: string | null
          id_photo_front_url: string | null
          last_name: string
          marital_status: string | null
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
          business_photo_url?: string | null
          city?: string | null
          client_number?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          employment_status?: string | null
          first_name: string
          gender?: string | null
          id?: string
          id_number: string
          id_photo_back_url?: string | null
          id_photo_front_url?: string | null
          last_name: string
          marital_status?: string | null
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
          business_photo_url?: string | null
          city?: string | null
          client_number?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          employment_status?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          id_number?: string
          id_photo_back_url?: string | null
          id_photo_front_url?: string | null
          last_name?: string
          marital_status?: string | null
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
          amount_paid: number | null
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
          amount_paid?: number | null
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
          amount_paid?: number | null
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
        Relationships: [
          {
            foreignKeyName: "fk_loan_schedule_loan_id"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
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
          draw_down_balance: number
          frequency: string | null
          id: string
          interest_rate: number | null
          loan_number: string | null
          status: string
          term_months: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          balance: number
          client: string
          created_at?: string | null
          date?: string
          draw_down_balance?: number
          frequency?: string | null
          id?: string
          interest_rate?: number | null
          loan_number?: string | null
          status: string
          term_months?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          balance?: number
          client?: string
          created_at?: string | null
          date?: string
          draw_down_balance?: number
          frequency?: string | null
          id?: string
          interest_rate?: number | null
          loan_number?: string | null
          status?: string
          term_months?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      migration_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          data_type: string
          error_summary: Json | null
          failed_records: number | null
          id: string
          is_scheduled: boolean
          job_name: string
          mapping_config: Json | null
          processed_records: number | null
          schedule_frequency: string | null
          source_file_name: string
          source_file_path: string
          started_at: string | null
          status: string
          successful_records: number | null
          total_records: number | null
          updated_at: string
          validation_results: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          data_type: string
          error_summary?: Json | null
          failed_records?: number | null
          id?: string
          is_scheduled?: boolean
          job_name: string
          mapping_config?: Json | null
          processed_records?: number | null
          schedule_frequency?: string | null
          source_file_name: string
          source_file_path: string
          started_at?: string | null
          status?: string
          successful_records?: number | null
          total_records?: number | null
          updated_at?: string
          validation_results?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          data_type?: string
          error_summary?: Json | null
          failed_records?: number | null
          id?: string
          is_scheduled?: boolean
          job_name?: string
          mapping_config?: Json | null
          processed_records?: number | null
          schedule_frequency?: string | null
          source_file_name?: string
          source_file_path?: string
          started_at?: string | null
          status?: string
          successful_records?: number | null
          total_records?: number | null
          updated_at?: string
          validation_results?: Json | null
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
      user_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id?: string
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
      approve_user: {
        Args:
          | {
              assigned_role?: Database["public"]["Enums"]["user_role"]
              target_user_id: string
            }
          | { target_user_id: string }
        Returns: undefined
      }
      calculate_outstanding_balance: {
        Args: { p_loan_id: string }
        Returns: number
      }
      deactivate_user: {
        Args: { reason?: string; target_user_id: string }
        Returns: undefined
      }
      generate_client_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_loan_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_loan_schedule: {
        Args: {
          p_amount: number
          p_frequency: string
          p_interest_rate: number
          p_loan_id: string
          p_start_date: string
          p_term_months: number
        }
        Returns: undefined
      }
      get_or_create_client_draw_down_account: {
        Args: { p_client_id: string }
        Returns: string
      }
      get_user_email: {
        Args: { user_id_input: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reject_user: {
        Args: { reason?: string; target_user_id: string }
        Returns: undefined
      }
      update_loan_status: {
        Args: { p_loan_id: string }
        Returns: undefined
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected" | "deactivated"
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
      approval_status: ["pending", "approved", "rejected", "deactivated"],
      user_role: ["admin", "loan_officer", "data_entry"],
    },
  },
} as const
