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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      brand_logos: {
        Row: {
          brand_name: string
          created_at: string
          file_path: string | null
          id: string
          logo_url: string
          updated_at: string
        }
        Insert: {
          brand_name: string
          created_at?: string
          file_path?: string | null
          id?: string
          logo_url: string
          updated_at?: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          file_path?: string | null
          id?: string
          logo_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      fortnox_article_sync: {
        Row: {
          created_at: string
          fortnox_article_number: string
          id: string
          inventory_item_id: string
          last_synced_at: string
          sync_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fortnox_article_number: string
          id?: string
          inventory_item_id: string
          last_synced_at?: string
          sync_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fortnox_article_number?: string
          id?: string
          inventory_item_id?: string
          last_synced_at?: string
          sync_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fortnox_article_sync_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fortnox_corrections: {
        Row: {
          correction_date: string
          correction_number: string
          correction_series: string
          created_at: string
          id: string
          original_number: string
          original_series: string
          updated_at: string
          user_id: string
        }
        Insert: {
          correction_date: string
          correction_number: string
          correction_series: string
          created_at?: string
          id?: string
          original_number: string
          original_series: string
          updated_at?: string
          user_id: string
        }
        Update: {
          correction_date?: string
          correction_number?: string
          correction_series?: string
          created_at?: string
          id?: string
          original_number?: string
          original_series?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fortnox_errors_log: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          timestamp: string | null
          type: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          timestamp?: string | null
          type: string
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          timestamp?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      fortnox_integrations: {
        Row: {
          access_token: string
          code_used_at: string | null
          company_name: string | null
          created_at: string
          fortnox_company_id: string | null
          id: string
          is_active: boolean
          oauth_code: string | null
          organization_id: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          code_used_at?: string | null
          company_name?: string | null
          created_at?: string
          fortnox_company_id?: string | null
          id?: string
          is_active?: boolean
          oauth_code?: string | null
          organization_id: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          code_used_at?: string | null
          company_name?: string | null
          created_at?: string
          fortnox_company_id?: string | null
          id?: string
          is_active?: boolean
          oauth_code?: string | null
          organization_id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fortnox_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fortnox_oauth_states: {
        Row: {
          created_at: string
          id: string
          state: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          state: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          state?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fortnox_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          fortnox_verification_number: string | null
          id: string
          inventory_item_id: string
          sync_data: Json | null
          sync_status: string
          sync_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          fortnox_verification_number?: string | null
          id?: string
          inventory_item_id: string
          sync_data?: Json | null
          sync_status: string
          sync_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          fortnox_verification_number?: string | null
          id?: string
          inventory_item_id?: string
          sync_data?: Json | null
          sync_status?: string
          sync_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fortnox_sync_log_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          additional_costs: number | null
          brand: string
          brand_other: string | null
          chassis_number: string | null
          comment: string | null
          created_at: string
          current_location: string | null
          customer_country: string | null
          customer_type: string | null
          down_payment: number | null
          down_payment_docs_sent: boolean | null
          down_payment_document_path: string | null
          expected_selling_price: number | null
          financing_details: string | null
          financing_provided: boolean | null
          first_registration_date: string | null
          fortnox_sync_status: string | null
          fortnox_synced_at: string | null
          fortnox_verification_number: string | null
          id: string
          logistics_documentation_attached: boolean | null
          logistics_notes: string | null
          marketplace_channel: string | null
          marketplace_channel_other: string | null
          mileage: number | null
          model: string | null
          organization_id: string
          purchase_channel: string | null
          purchase_channel_other: string | null
          purchase_date: string
          purchase_docs_sent: boolean | null
          purchase_documentation: string | null
          purchase_price: number
          purchaser: string
          registration_number: string
          sales_channel: string | null
          sales_documentation: string | null
          sales_notes: string | null
          seller: string | null
          selling_date: string | null
          selling_price: number | null
          status: string
          updated_at: string
          user_id: string
          vat_type: string | null
          warranty_details: string | null
          warranty_provided: boolean | null
          year_model: number | null
        }
        Insert: {
          additional_costs?: number | null
          brand: string
          brand_other?: string | null
          chassis_number?: string | null
          comment?: string | null
          created_at?: string
          current_location?: string | null
          customer_country?: string | null
          customer_type?: string | null
          down_payment?: number | null
          down_payment_docs_sent?: boolean | null
          down_payment_document_path?: string | null
          expected_selling_price?: number | null
          financing_details?: string | null
          financing_provided?: boolean | null
          first_registration_date?: string | null
          fortnox_sync_status?: string | null
          fortnox_synced_at?: string | null
          fortnox_verification_number?: string | null
          id?: string
          logistics_documentation_attached?: boolean | null
          logistics_notes?: string | null
          marketplace_channel?: string | null
          marketplace_channel_other?: string | null
          mileage?: number | null
          model?: string | null
          organization_id: string
          purchase_channel?: string | null
          purchase_channel_other?: string | null
          purchase_date: string
          purchase_docs_sent?: boolean | null
          purchase_documentation?: string | null
          purchase_price: number
          purchaser: string
          registration_number: string
          sales_channel?: string | null
          sales_documentation?: string | null
          sales_notes?: string | null
          seller?: string | null
          selling_date?: string | null
          selling_price?: number | null
          status?: string
          updated_at?: string
          user_id: string
          vat_type?: string | null
          warranty_details?: string | null
          warranty_provided?: boolean | null
          year_model?: number | null
        }
        Update: {
          additional_costs?: number | null
          brand?: string
          brand_other?: string | null
          chassis_number?: string | null
          comment?: string | null
          created_at?: string
          current_location?: string | null
          customer_country?: string | null
          customer_type?: string | null
          down_payment?: number | null
          down_payment_docs_sent?: boolean | null
          down_payment_document_path?: string | null
          expected_selling_price?: number | null
          financing_details?: string | null
          financing_provided?: boolean | null
          first_registration_date?: string | null
          fortnox_sync_status?: string | null
          fortnox_synced_at?: string | null
          fortnox_verification_number?: string | null
          id?: string
          logistics_documentation_attached?: boolean | null
          logistics_notes?: string | null
          marketplace_channel?: string | null
          marketplace_channel_other?: string | null
          mileage?: number | null
          model?: string | null
          organization_id?: string
          purchase_channel?: string | null
          purchase_channel_other?: string | null
          purchase_date?: string
          purchase_docs_sent?: boolean | null
          purchase_documentation?: string | null
          purchase_price?: number
          purchaser?: string
          registration_number?: string
          sales_channel?: string | null
          sales_documentation?: string | null
          sales_notes?: string | null
          seller?: string | null
          selling_date?: string | null
          selling_price?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          vat_type?: string | null
          warranty_details?: string | null
          warranty_provided?: boolean | null
          year_model?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_car_cache: {
        Row: {
          created_at: string
          id: string
          registration_number: string
          scraped_data: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          registration_number: string
          scraped_data: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          registration_number?: string
          scraped_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_remove_admin_role: {
        Args: { _user_id: string; _organization_id: string }
        Returns: boolean
      }
      cleanup_old_oauth_states: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _organization_id?: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "administrator"
        | "bilhandel"
        | "ekonomi"
        | "superuser"
        | "admin"
        | "lager"
        | "inkop"
        | "pakostnad"
        | "forsaljning"
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
      app_role: [
        "administrator",
        "bilhandel",
        "ekonomi",
        "superuser",
        "admin",
        "lager",
        "inkop",
        "pakostnad",
        "forsaljning",
      ],
    },
  },
} as const
