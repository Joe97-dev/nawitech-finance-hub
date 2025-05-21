export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
