/**
 * Generated from the live `carguy` schema on x-core. Do not edit by hand.
 *
 *   npx supabase gen types typescript --project-id <ref> --schema carguy \
 *     > lib/cloud/database.types.ts
 *
 * Regenerate after any migration in sql/. `__tests__/sync/schema-parity.test.ts`
 * compares the local SQLite schema against sql/002 and will fail if the two
 * drift, but nothing checks this file against the database — so a stale copy
 * here is a lie TypeScript will happily believe.
 */

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
  carguy: {
    Tables: {
      document: {
        Row: {
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          issued_at: string | null
          kind: string
          media_id: string | null
          notes: string
          reminder_id: string | null
          server_updated_at: string
          title: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          expires_at?: string | null
          id: string
          issued_at?: string | null
          kind: string
          media_id?: string | null
          notes?: string
          reminder_id?: string | null
          server_updated_at?: string
          title: string
          updated_at: string
          user_id?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          kind?: string
          media_id?: string | null
          notes?: string
          reminder_id?: string | null
          server_updated_at?: string
          title?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      expense: {
        Row: {
          amount_dop: number
          category: string
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          occurred_at: string
          odometer_km: number | null
          server_updated_at: string
          updated_at: string
          user_id: string
          vehicle_id: string
          vendor: string
        }
        Insert: {
          amount_dop: number
          category: string
          created_at: string
          deleted_at?: string | null
          description?: string
          id: string
          occurred_at: string
          odometer_km?: number | null
          server_updated_at?: string
          updated_at: string
          user_id?: string
          vehicle_id: string
          vendor?: string
        }
        Update: {
          amount_dop?: number
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          occurred_at?: string
          odometer_km?: number | null
          server_updated_at?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
          vendor?: string
        }
        Relationships: []
      }
      fuel_log: {
        Row: {
          created_at: string
          deleted_at: string | null
          fuel_type: string
          id: string
          is_full_tank: boolean
          missed_previous: boolean
          notes: string
          occurred_at: string
          odometer_km: number
          price_per_unit: number
          server_updated_at: string
          station: string
          total_dop: number
          updated_at: string
          user_id: string
          vehicle_id: string
          volume: number
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          fuel_type: string
          id: string
          is_full_tank?: boolean
          missed_previous?: boolean
          notes?: string
          occurred_at: string
          odometer_km: number
          price_per_unit: number
          server_updated_at?: string
          station?: string
          total_dop: number
          updated_at: string
          user_id?: string
          vehicle_id: string
          volume: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          fuel_type?: string
          id?: string
          is_full_tank?: boolean
          missed_previous?: boolean
          notes?: string
          occurred_at?: string
          odometer_km?: number
          price_per_unit?: number
          server_updated_at?: string
          station?: string
          total_dop?: number
          updated_at?: string
          user_id?: string
          vehicle_id?: string
          volume?: number
        }
        Relationships: []
      }
      inspection: {
        Row: {
          created_at: string
          deleted_at: string | null
          duration_sec: number | null
          id: string
          notes: string
          occurred_at: string
          odometer_km: number | null
          server_updated_at: string
          status: string
          template_id: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          duration_sec?: number | null
          id: string
          notes?: string
          occurred_at: string
          odometer_km?: number | null
          server_updated_at?: string
          status: string
          template_id: string
          updated_at: string
          user_id?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          duration_sec?: number | null
          id?: string
          notes?: string
          occurred_at?: string
          odometer_km?: number | null
          server_updated_at?: string
          status?: string
          template_id?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      inspection_item: {
        Row: {
          created_at: string
          deleted_at: string | null
          group_name: string
          how: string
          id: string
          label: string
          on_fail: string
          related_service_type_id: string | null
          requires_cold_engine: boolean
          server_updated_at: string
          sort_order: number
          template_id: string
          updated_at: string
          user_id: string
          warning: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          group_name: string
          how?: string
          id: string
          label: string
          on_fail?: string
          related_service_type_id?: string | null
          requires_cold_engine?: boolean
          server_updated_at?: string
          sort_order?: number
          template_id: string
          updated_at: string
          user_id?: string
          warning?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          group_name?: string
          how?: string
          id?: string
          label?: string
          on_fail?: string
          related_service_type_id?: string | null
          requires_cold_engine?: boolean
          server_updated_at?: string
          sort_order?: number
          template_id?: string
          updated_at?: string
          user_id?: string
          warning?: string
        }
        Relationships: []
      }
      inspection_result: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          inspection_id: string
          item_id: string
          label_snapshot: string
          media_id: string | null
          note: string
          result: string
          server_updated_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          id: string
          inspection_id: string
          item_id: string
          label_snapshot: string
          media_id?: string | null
          note?: string
          result: string
          server_updated_at?: string
          updated_at: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          inspection_id?: string
          item_id?: string
          label_snapshot?: string
          media_id?: string | null
          note?: string
          result?: string
          server_updated_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inspection_template: {
        Row: {
          cadence: string
          created_at: string
          deleted_at: string | null
          id: string
          is_enabled: boolean
          is_seeded: boolean
          name: string
          server_updated_at: string
          updated_at: string
          user_id: string
          vehicle_id: string | null
          vehicle_type: string
        }
        Insert: {
          cadence: string
          created_at: string
          deleted_at?: string | null
          id: string
          is_enabled?: boolean
          is_seeded?: boolean
          name: string
          server_updated_at?: string
          updated_at: string
          user_id?: string
          vehicle_id?: string | null
          vehicle_type?: string
        }
        Update: {
          cadence?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_enabled?: boolean
          is_seeded?: boolean
          name?: string
          server_updated_at?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          created_at: string
          deleted_at: string | null
          height: number | null
          id: string
          kind: string
          mime: string
          owner_id: string
          owner_table: string
          rel_path: string | null
          remote_path: string | null
          server_updated_at: string
          size_bytes: number | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          height?: number | null
          id: string
          kind: string
          mime: string
          owner_id: string
          owner_table: string
          rel_path?: string | null
          remote_path?: string | null
          server_updated_at?: string
          size_bytes?: number | null
          updated_at: string
          user_id?: string
          width?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime?: string
          owner_id?: string
          owner_table?: string
          rel_path?: string | null
          remote_path?: string | null
          server_updated_at?: string
          size_bytes?: number | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      odometer_reading: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          occurred_at: string
          server_updated_at: string
          source: string
          source_id: string | null
          updated_at: string
          user_id: string
          value_km: number
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          id: string
          occurred_at: string
          server_updated_at?: string
          source: string
          source_id?: string | null
          updated_at: string
          user_id?: string
          value_km: number
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          occurred_at?: string
          server_updated_at?: string
          source?: string
          source_id?: string | null
          updated_at?: string
          user_id?: string
          value_km?: number
          vehicle_id?: string
        }
        Relationships: []
      }
      part: {
        Row: {
          brand: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          part_number: string | null
          quantity: number
          server_updated_at: string
          service_record_id: string
          unit_cost_dop: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at: string
          deleted_at?: string | null
          id: string
          name: string
          part_number?: string | null
          quantity?: number
          server_updated_at?: string
          service_record_id: string
          unit_cost_dop?: number | null
          updated_at: string
          user_id?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          part_number?: string | null
          quantity?: number
          server_updated_at?: string
          service_record_id?: string
          unit_cost_dop?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder: {
        Row: {
          created_at: string
          deleted_at: string | null
          due_date: string | null
          due_km: number | null
          fixed_interval: boolean
          id: string
          interval_days: number | null
          interval_km: number | null
          interval_months: number | null
          is_enabled: boolean
          is_recurring: boolean
          last_completed_at: string | null
          last_completed_km: number | null
          last_completed_record_id: string | null
          legal_kind: string | null
          metric: string
          notes: string
          server_updated_at: string
          service_type_id: string | null
          snoozed_until: string | null
          threshold_days: number | null
          threshold_km: number | null
          title: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          due_date?: string | null
          due_km?: number | null
          fixed_interval?: boolean
          id: string
          interval_days?: number | null
          interval_km?: number | null
          interval_months?: number | null
          is_enabled?: boolean
          is_recurring?: boolean
          last_completed_at?: string | null
          last_completed_km?: number | null
          last_completed_record_id?: string | null
          legal_kind?: string | null
          metric: string
          notes?: string
          server_updated_at?: string
          service_type_id?: string | null
          snoozed_until?: string | null
          threshold_days?: number | null
          threshold_km?: number | null
          title: string
          updated_at: string
          user_id?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          due_km?: number | null
          fixed_interval?: boolean
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          interval_months?: number | null
          is_enabled?: boolean
          is_recurring?: boolean
          last_completed_at?: string | null
          last_completed_km?: number | null
          last_completed_record_id?: string | null
          legal_kind?: string | null
          metric?: string
          notes?: string
          server_updated_at?: string
          service_type_id?: string | null
          snoozed_until?: string | null
          threshold_days?: number | null
          threshold_km?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      service_record: {
        Row: {
          cost_labor_dop: number
          cost_parts_dop: number
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          kind: string
          occurred_at: string
          odometer_km: number | null
          server_updated_at: string
          shop: string
          source_inspection_id: string | null
          source_task_id: string | null
          title: string
          total_dop: number
          updated_at: string
          user_id: string
          vehicle_id: string
          warranty_until_date: string | null
          warranty_until_km: number | null
        }
        Insert: {
          cost_labor_dop?: number
          cost_parts_dop?: number
          created_at: string
          deleted_at?: string | null
          description?: string
          id: string
          kind: string
          occurred_at: string
          odometer_km?: number | null
          server_updated_at?: string
          shop?: string
          source_inspection_id?: string | null
          source_task_id?: string | null
          title: string
          total_dop?: number
          updated_at: string
          user_id?: string
          vehicle_id: string
          warranty_until_date?: string | null
          warranty_until_km?: number | null
        }
        Update: {
          cost_labor_dop?: number
          cost_parts_dop?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          kind?: string
          occurred_at?: string
          odometer_km?: number | null
          server_updated_at?: string
          shop?: string
          source_inspection_id?: string | null
          source_task_id?: string | null
          title?: string
          total_dop?: number
          updated_at?: string
          user_id?: string
          vehicle_id?: string
          warranty_until_date?: string | null
          warranty_until_km?: number | null
        }
        Relationships: []
      }
      service_record_item: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          notes: string
          server_updated_at: string
          service_record_id: string
          service_type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          id: string
          notes?: string
          server_updated_at?: string
          service_record_id: string
          service_type_id: string
          updated_at: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string
          server_updated_at?: string
          service_record_id?: string
          service_type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_type: {
        Row: {
          applies_to: string
          category: string
          created_at: string
          default_interval_km: number | null
          default_interval_months: number | null
          deleted_at: string | null
          id: string
          is_seeded: boolean
          name: string
          server_updated_at: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          applies_to?: string
          category: string
          created_at: string
          default_interval_km?: number | null
          default_interval_months?: number | null
          deleted_at?: string | null
          id: string
          is_seeded?: boolean
          name: string
          server_updated_at?: string
          sort_order?: number
          updated_at: string
          user_id?: string
        }
        Update: {
          applies_to?: string
          category?: string
          created_at?: string
          default_interval_km?: number | null
          default_interval_months?: number | null
          deleted_at?: string | null
          id?: string
          is_seeded?: boolean
          name?: string
          server_updated_at?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      setting: {
        Row: {
          key: string
          server_updated_at: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          key: string
          server_updated_at?: string
          updated_at: string
          user_id?: string
          value: Json
        }
        Update: {
          key?: string
          server_updated_at?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      task: {
        Row: {
          created_at: string
          deleted_at: string | null
          done_record_id: string | null
          estimated_cost_dop: number | null
          id: string
          kind: string
          notes: string
          priority: string
          server_updated_at: string
          source_inspection_result_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          done_record_id?: string | null
          estimated_cost_dop?: number | null
          id: string
          kind?: string
          notes?: string
          priority?: string
          server_updated_at?: string
          source_inspection_result_id?: string | null
          status?: string
          title: string
          updated_at: string
          user_id?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          done_record_id?: string | null
          estimated_cost_dop?: number | null
          id?: string
          kind?: string
          notes?: string
          priority?: string
          server_updated_at?: string
          source_inspection_result_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle: {
        Row: {
          color: string | null
          created_at: string
          default_fuel_type: string
          deleted_at: string | null
          id: string
          initial_odometer_km: number | null
          is_archived: boolean
          make: string | null
          model: string | null
          name: string
          notes: string
          photo_media_id: string | null
          plate: string | null
          purchase_date: string | null
          purchase_price: number | null
          server_updated_at: string
          sold_date: string | null
          sold_price: number | null
          sort_order: number
          tank_volume: number | null
          trim: string | null
          type: string
          updated_at: string
          user_id: string
          vin: string | null
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at: string
          default_fuel_type: string
          deleted_at?: string | null
          id: string
          initial_odometer_km?: number | null
          is_archived?: boolean
          make?: string | null
          model?: string | null
          name: string
          notes?: string
          photo_media_id?: string | null
          plate?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          server_updated_at?: string
          sold_date?: string | null
          sold_price?: number | null
          sort_order?: number
          tank_volume?: number | null
          trim?: string | null
          type?: string
          updated_at: string
          user_id?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          default_fuel_type?: string
          deleted_at?: string | null
          id?: string
          initial_odometer_km?: number | null
          is_archived?: boolean
          make?: string | null
          model?: string | null
          name?: string
          notes?: string
          photo_media_id?: string | null
          plate?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          server_updated_at?: string
          sold_date?: string | null
          sold_price?: number | null
          sort_order?: number
          tank_volume?: number | null
          trim?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
      vehicle_spec: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          server_updated_at: string
          sort_order: number
          updated_at: string
          user_id: string
          value: string
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          id: string
          name: string
          server_updated_at?: string
          sort_order?: number
          updated_at: string
          user_id?: string
          value: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          server_updated_at?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          value?: string
          vehicle_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  carguy: {
    Enums: {},
  },
} as const
