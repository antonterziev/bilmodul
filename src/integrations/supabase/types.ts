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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      account_mappings: {
        Row: {
          account_name: string
          account_number: string
          created_at: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_account_mappings_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          encryption_key_id: string | null
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
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          encryption_key_id?: string | null
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
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          encryption_key_id?: string | null
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
          synced_by_user_id: string | null
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
          synced_by_user_id?: string | null
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
          synced_by_user_id?: string | null
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
          brand: string
          brand_other: string | null
          chassi_number: string | null
          created_at: string
          customer_country: string | null
          customer_type: string | null
          down_payment: number | null
          down_payment_docs_sent: boolean | null
          down_payment_document_path: string | null
          first_registration_date: string | null
          fortnox_invoice_number: string | null
          fortnox_project_number: string | null
          fortnox_sync_status: string | null
          fortnox_synced_at: string | null
          fortnox_synced_by_user_id: string | null
          fortnox_verification_number: string | null
          id: string
          inventory_value: number | null
          marketplace_channel: string | null
          marketplace_channel_other: string | null
          mileage: number | null
          model: string | null
          note: string | null
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
          vat_amount: number | null
          vat_type: string | null
          year_model: number | null
        }
        Insert: {
          brand: string
          brand_other?: string | null
          chassi_number?: string | null
          created_at?: string
          customer_country?: string | null
          customer_type?: string | null
          down_payment?: number | null
          down_payment_docs_sent?: boolean | null
          down_payment_document_path?: string | null
          first_registration_date?: string | null
          fortnox_invoice_number?: string | null
          fortnox_project_number?: string | null
          fortnox_sync_status?: string | null
          fortnox_synced_at?: string | null
          fortnox_synced_by_user_id?: string | null
          fortnox_verification_number?: string | null
          id?: string
          inventory_value?: number | null
          marketplace_channel?: string | null
          marketplace_channel_other?: string | null
          mileage?: number | null
          model?: string | null
          note?: string | null
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
          vat_amount?: number | null
          vat_type?: string | null
          year_model?: number | null
        }
        Update: {
          brand?: string
          brand_other?: string | null
          chassi_number?: string | null
          created_at?: string
          customer_country?: string | null
          customer_type?: string | null
          down_payment?: number | null
          down_payment_docs_sent?: boolean | null
          down_payment_document_path?: string | null
          first_registration_date?: string | null
          fortnox_invoice_number?: string | null
          fortnox_project_number?: string | null
          fortnox_sync_status?: string | null
          fortnox_synced_at?: string | null
          fortnox_synced_by_user_id?: string | null
          fortnox_verification_number?: string | null
          id?: string
          inventory_value?: number | null
          marketplace_channel?: string | null
          marketplace_channel_other?: string | null
          mileage?: number | null
          model?: string | null
          note?: string | null
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
          vat_amount?: number | null
          vat_type?: string | null
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
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by_user_id: string
          organization_id: string
          permissions: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by_user_id: string
          organization_id: string
          permissions?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by_user_id?: string
          organization_id?: string
          permissions?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
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
          organization_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_number?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      pakostnader: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          fortnox_invoice_number: string | null
          id: string
          inventory_item_id: string
          is_synced: boolean | null
          supplier: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          description?: string | null
          fortnox_invoice_number?: string | null
          id?: string
          inventory_item_id: string
          is_synced?: boolean | null
          supplier: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          fortnox_invoice_number?: string | null
          id?: string
          inventory_item_id?: string
          is_synced?: boolean | null
          supplier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pakostnader_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
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
      rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          request_count: number | null
          updated_at: string | null
          user_id: string | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          request_count?: number | null
          updated_at?: string | null
          user_id?: string | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          request_count?: number | null
          updated_at?: string | null
          user_id?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      scraped_car_cache: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          registration_number: string
          scraped_data: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          registration_number: string
          scraped_data: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          registration_number?: string
          scraped_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraped_car_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          created_at: string | null
          event_description: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_description: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_description?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_notes: {
        Row: {
          created_at: string
          id: string
          note_text: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_text: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_text?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_notes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_inventory_value: {
        Args: {
          inventory_item_id_param: string
          purchase_price_param: number
          vat_type_param: string
        }
        Returns: number
      }
      can_remove_admin_permission: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      can_remove_admin_role: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_ip_address: string
          p_limit?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_old_oauth_states: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_current_user_permission: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_permission"]
      }
      get_user_organization_id: {
        Args: { _user_id?: string }
        Returns: string
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          p_event_description: string
          p_event_type: string
          p_ip_address?: string
          p_metadata?: Json
          p_user_agent?: string
          p_user_id: string
        }
        Returns: undefined
      }
      populate_default_account_mappings: {
        Args: { _organization_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_permission:
        | "admin"
        | "lager"
        | "ekonomi"
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
      app_permission: [
        "admin",
        "lager",
        "ekonomi",
        "inkop",
        "pakostnad",
        "forsaljning",
      ],
    },
  },
} as const
