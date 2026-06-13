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
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
          tenant_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          tenant_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          tenant_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          default_critical_days: number
          default_warning_days: number
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          default_critical_days?: number
          default_warning_days?: number
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          default_critical_days?: number
          default_warning_days?: number
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          id: string
          name: string
          permissions: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permissions: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permissions?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      damaged_products: {
        Row: {
          batch_id: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          quantity: number
          reason: Database["public"]["Enums"]["damage_reason"]
          tenant_id: string
        }
        Insert: {
          batch_id?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          reason?: Database["public"]["Enums"]["damage_reason"]
          tenant_id: string
        }
        Update: {
          batch_id?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          reason?: Database["public"]["Enums"]["damage_reason"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "damaged_products_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          batch_id: string | null
          cost_price: number
          expiry_date: string | null
          id: string
          product_id: string
          quantity: number
          receipt_id: string
        }
        Insert: {
          batch_id?: string | null
          cost_price: number
          expiry_date?: string | null
          id?: string
          product_id: string
          quantity: number
          receipt_id: string
        }
        Update: {
          batch_id?: string | null
          cost_price?: number
          expiry_date?: string | null
          id?: string
          product_id?: string
          quantity?: number
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          reference: string | null
          supplier_id: string | null
          tenant_id: string
          total_cost: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reference?: string | null
          supplier_id?: string | null
          tenant_id: string
          total_cost?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reference?: string | null
          supplier_id?: string | null
          tenant_id?: string
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_items: {
        Row: {
          count_id: string
          counted_qty: number
          created_at: string
          expected_qty: number
          id: string
          product_id: string
        }
        Insert: {
          count_id: string
          counted_qty?: number
          created_at?: string
          expected_qty?: number
          id?: string
          product_id: string
        }
        Update: {
          count_id?: string
          counted_qty?: number
          created_at?: string
          expected_qty?: number
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          branch_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          status: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          custom_role_id: string | null
          default_role: Database["public"]["Enums"]["user_role"]
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          custom_role_id?: string | null
          default_role: Database["public"]["Enums"]["user_role"]
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          custom_role_id?: string | null
          default_role?: Database["public"]["Enums"]["user_role"]
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          branch_id: string | null
          created_at: string
          custom_role_id: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          branch_id: string | null
          created_at: string
          id: string
          is_read: boolean
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          body?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          body?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          tenant_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_import_items: {
        Row: {
          barcode: string | null
          id: string
          import_id: string
          product_id: string | null
          quantity: number
          sold_at: string | null
          total: number
        }
        Insert: {
          barcode?: string | null
          id?: string
          import_id: string
          product_id?: string | null
          quantity: number
          sold_at?: string | null
          total?: number
        }
        Update: {
          barcode?: string | null
          id?: string
          import_id?: string
          product_id?: string | null
          quantity?: number
          sold_at?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_import_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "pos_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_import_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_imports: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          rows_count: number
          source: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          rows_count?: number
          source?: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          rows_count?: number
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_imports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_imports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_ops: {
        Row: {
          client_op_id: string
          created_at: string
          op_type: string
          result: Json
          tenant_id: string
          user_id: string
        }
        Insert: {
          client_op_id: string
          created_at?: string
          op_type: string
          result: Json
          tenant_id: string
          user_id: string
        }
        Update: {
          client_op_id?: string
          created_at?: string
          op_type?: string
          result?: Json
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_ops_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost_price: number
          created_at: string
          expiry_critical_days: number | null
          expiry_warning_days: number | null
          id: string
          is_active: boolean
          low_stock_threshold: number
          name: string
          sell_price: number
          tenant_id: string
          unit: Database["public"]["Enums"]["product_unit"]
          vat_inclusive: boolean
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          expiry_critical_days?: number | null
          expiry_warning_days?: number | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          sell_price?: number
          tenant_id: string
          unit?: Database["public"]["Enums"]["product_unit"]
          vat_inclusive?: boolean
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          expiry_critical_days?: number | null
          expiry_warning_days?: number | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          sell_price?: number
          tenant_id?: string
          unit?: Database["public"]["Enums"]["product_unit"]
          vat_inclusive?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      stock_batches: {
        Row: {
          branch_id: string
          cost_price: number
          created_at: string
          expiry_date: string | null
          id: string
          product_id: string
          quantity: number
          received_at: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          product_id: string
          quantity?: number
          received_at?: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          product_id?: string
          quantity?: number
          received_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          reference_id: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          batch_id?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          reference_id?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          batch_id?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          trn: string | null
          vat_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          trn?: string | null
          vat_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          trn?: string | null
          vat_rate?: number
        }
        Relationships: []
      }
      webhook_endpoints: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          last_used_at: string | null
          secret_hash: string
          secret_prefix: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          last_used_at?: string | null
          secret_hash: string
          secret_prefix: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_used_at?: string | null
          secret_hash?: string
          secret_prefix?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _guard: {
        Args: {
          p_roles: Database["public"]["Enums"]["user_role"][]
          p_tenant: string
        }
        Returns: undefined
      }
      apply_pos_import: { Args: { p_payload: Json }; Returns: Json }
      generate_webhook_secret: {
        Args: { p_branch: string; p_label: string }
        Returns: { endpoint_id: string; secret: string }[]
      }
      revoke_webhook_endpoint: { Args: { p_endpoint: string }; Returns: undefined }
      auth_tenant_ids: { Args: never; Returns: string[] }
      bootstrap_tenant: {
        Args: { p_company: string; p_full_name: string; p_user_id: string }
        Returns: string
      }
      close_count: { Args: { p_payload: Json }; Returns: Json }
      has_role: {
        Args: {
          p_roles: Database["public"]["Enums"]["user_role"][]
          p_tenant: string
        }
        Returns: boolean
      }
      receive_goods: { Args: { p_payload: Json }; Returns: Json }
      record_damage: { Args: { p_payload: Json }; Returns: Json }
    }
    Enums: {
      damage_reason: "expired" | "broken" | "spoiled" | "other"
      movement_type: "receipt" | "sale" | "damage" | "adjustment" | "count"
      notification_type:
        | "expiry_soon"
        | "low_stock"
        | "receipt"
        | "damage"
        | "count"
        | "system"
      product_unit: "pcs" | "kg"
      user_role: "owner" | "manager" | "staff"
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
      damage_reason: ["expired", "broken", "spoiled", "other"],
      movement_type: ["receipt", "sale", "damage", "adjustment", "count"],
      notification_type: [
        "expiry_soon",
        "low_stock",
        "receipt",
        "damage",
        "count",
        "system",
      ],
      product_unit: ["pcs", "kg"],
      user_role: ["owner", "manager", "staff"],
    },
  },
} as const
