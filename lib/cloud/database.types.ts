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
      album_item: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          media_id: string
          milestone_id: string | null
          mod_id: string | null
          role: string
          server_updated_at: string
          sort_order: number
          track_event_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          id: string
          media_id: string
          milestone_id?: string | null
          mod_id?: string | null
          role?: string
          server_updated_at?: string
          sort_order?: number
          track_event_id?: string | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          media_id?: string
          milestone_id?: string | null
          mod_id?: string | null
          role?: string
          server_updated_at?: string
          sort_order?: number
          track_event_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      consumable_usage: {
        Row: {
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          kind: string
          notes: string
          pad_thickness_mm: number | null
          qty: number | null
          server_updated_at: string
          session_id: string | null
          tire_id: string | null
          tread_mm: number | null
          unit: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          wheel_set_id: string | null
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          event_id: string
          id: string
          kind: string
          notes?: string
          pad_thickness_mm?: number | null
          qty?: number | null
          server_updated_at?: string
          session_id?: string | null
          tire_id?: string | null
          tread_mm?: number | null
          unit?: string | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          wheel_set_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          kind?: string
          notes?: string
          pad_thickness_mm?: number | null
          qty?: number | null
          server_updated_at?: string
          session_id?: string | null
          tire_id?: string | null
          tread_mm?: number | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          wheel_set_id?: string | null
        }
        Relationships: []
      }
      contact: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          name: string
          notes: string
          phone: string | null
          rating: number | null
          server_updated_at: string
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          created_at: string
          deleted_at?: string | null
          id: string
          kind: string
          name: string
          notes?: string
          phone?: string | null
          rating?: number | null
          server_updated_at?: string
          updated_at: string
          user_id?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string
          phone?: string | null
          rating?: number | null
          server_updated_at?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
          vendor?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_note: string | null
          app_version: string | null
          build: string | null
          created_at: string
          device: string | null
          device_id: string
          diagnostics: Json | null
          email: string | null
          id: string
          kind: string
          message: string
          os_version: string | null
          platform: string | null
          screen: string | null
          screenshot_path: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          app_version?: string | null
          build?: string | null
          created_at?: string
          device?: string | null
          device_id: string
          diagnostics?: Json | null
          email?: string | null
          id?: string
          kind: string
          message: string
          os_version?: string | null
          platform?: string | null
          screen?: string | null
          screenshot_path?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          app_version?: string | null
          build?: string | null
          created_at?: string
          device?: string | null
          device_id?: string
          diagnostics?: Json | null
          email?: string | null
          id?: string
          kind?: string
          message?: string
          os_version?: string | null
          platform?: string | null
          screen?: string | null
          screenshot_path?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fluid_guide_item: {
        Row: {
          created_at: string
          deleted_at: string | null
          how: string
          id: string
          kind: string
          media_id: string | null
          notes: string
          server_updated_at: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          how?: string
          id: string
          kind: string
          media_id?: string | null
          notes?: string
          server_updated_at?: string
          sort_order?: number
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          how?: string
          id?: string
          kind?: string
          media_id?: string | null
          notes?: string
          server_updated_at?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      fuel_log: {
        Row: {
          created_at: string
          deleted_at: string | null
          fuel_type: string
          gauge_after_eighths: number | null
          gauge_before_eighths: number | null
          id: string
          in_reserve: boolean
          is_full_tank: boolean
          missed_previous: boolean
          notes: string
          occurred_at: string
          odometer_km: number
          price_per_l: number | null
          price_per_unit: number
          schema_hint: string | null
          server_updated_at: string
          station: string
          total_dop: number
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
          volume: number
          volume_entered: number | null
          volume_entered_unit: string | null
          volume_l: number | null
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          fuel_type: string
          gauge_after_eighths?: number | null
          gauge_before_eighths?: number | null
          id: string
          in_reserve?: boolean
          is_full_tank?: boolean
          missed_previous?: boolean
          notes?: string
          occurred_at: string
          odometer_km: number
          price_per_l?: number | null
          price_per_unit: number
          schema_hint?: string | null
          server_updated_at?: string
          station?: string
          total_dop: number
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
          volume: number
          volume_entered?: number | null
          volume_entered_unit?: string | null
          volume_l?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          fuel_type?: string
          gauge_after_eighths?: number | null
          gauge_before_eighths?: number | null
          id?: string
          in_reserve?: boolean
          is_full_tank?: boolean
          missed_previous?: boolean
          notes?: string
          occurred_at?: string
          odometer_km?: number
          price_per_l?: number | null
          price_per_unit?: number
          schema_hint?: string | null
          server_updated_at?: string
          station?: string
          total_dop?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
          volume?: number
          volume_entered?: number | null
          volume_entered_unit?: string | null
          volume_l?: number | null
        }
        Relationships: []
      }
      fuel_price: {
        Row: {
          created_at: string
          deleted_at: string | null
          fuel_type: string
          id: string
          note: string
          price: number
          schema_hint: string | null
          server_updated_at: string
          source: string
          station: string
          updated_at: string
          updated_by: string | null
          user_id: string
          valid_from: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          fuel_type: string
          id: string
          note?: string
          price: number
          schema_hint?: string | null
          server_updated_at?: string
          source?: string
          station?: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
          valid_from: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          fuel_type?: string
          id?: string
          note?: string
          price?: number
          schema_hint?: string | null
          server_updated_at?: string
          source?: string
          station?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          valid_from?: string
        }
        Relationships: []
      }
      fuel_price_ref: {
        Row: {
          fuel_type: string
          imported_at: string
          pdf_url: string | null
          price: number
          raw_text: string | null
          source: string
          stale: boolean
          week_end: string
          week_start: string
        }
        Insert: {
          fuel_type: string
          imported_at?: string
          pdf_url?: string | null
          price: number
          raw_text?: string | null
          source?: string
          stale?: boolean
          week_end: string
          week_start: string
        }
        Update: {
          fuel_type?: string
          imported_at?: string
          pdf_url?: string | null
          price?: number
          raw_text?: string | null
          source?: string
          stale?: boolean
          week_end?: string
          week_start?: string
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
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
      inventory_item: {
        Row: {
          acquired_at: string | null
          brand: string | null
          condition: string
          cost_dop: number | null
          created_at: string
          deleted_at: string | null
          fits_vehicle_ids: string
          id: string
          kind: string
          location: string | null
          media_id: string | null
          name: string
          notes: string
          owner_vehicle_id: string | null
          part_number: string | null
          qty: number
          server_updated_at: string
          unit: string | null
          updated_at: string
          updated_by: string | null
          used_in_mod_id: string | null
          user_id: string
        }
        Insert: {
          acquired_at?: string | null
          brand?: string | null
          condition?: string
          cost_dop?: number | null
          created_at: string
          deleted_at?: string | null
          fits_vehicle_ids?: string
          id: string
          kind: string
          location?: string | null
          media_id?: string | null
          name: string
          notes?: string
          owner_vehicle_id?: string | null
          part_number?: string | null
          qty?: number
          server_updated_at?: string
          unit?: string | null
          updated_at: string
          updated_by?: string | null
          used_in_mod_id?: string | null
          user_id?: string
        }
        Update: {
          acquired_at?: string | null
          brand?: string | null
          condition?: string
          cost_dop?: number | null
          created_at?: string
          deleted_at?: string | null
          fits_vehicle_ids?: string
          id?: string
          kind?: string
          location?: string | null
          media_id?: string | null
          name?: string
          notes?: string
          owner_vehicle_id?: string | null
          part_number?: string | null
          qty?: number
          server_updated_at?: string
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          used_in_mod_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      legal_acceptance: {
        Row: {
          accepted_at: string
          created_at: string
          deleted_at: string | null
          device_id: string
          id: string
          locale: string
          platform: string
          server_updated_at: string
          updated_at: string
          updated_by: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at: string
          created_at: string
          deleted_at?: string | null
          device_id: string
          id: string
          locale: string
          platform: string
          server_updated_at?: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
          version: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          deleted_at?: string | null
          device_id?: string
          id?: string
          locale?: string
          platform?: string
          server_updated_at?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          blurhash: string | null
          caption: string
          created_at: string
          date_precision: string
          deleted_at: string | null
          height: number | null
          id: string
          is_favorite: boolean
          kind: string
          mime: string
          owner_id: string
          owner_table: string
          rel_path: string | null
          remote_path: string | null
          remote_thumb_path: string | null
          server_updated_at: string
          size_bytes: number | null
          source: string
          taken_at: string | null
          thumb_rel_path: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          blurhash?: string | null
          caption?: string
          created_at: string
          date_precision?: string
          deleted_at?: string | null
          height?: number | null
          id: string
          is_favorite?: boolean
          kind: string
          mime: string
          owner_id: string
          owner_table: string
          rel_path?: string | null
          remote_path?: string | null
          remote_thumb_path?: string | null
          server_updated_at?: string
          size_bytes?: number | null
          source?: string
          taken_at?: string | null
          thumb_rel_path?: string | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          width?: number | null
        }
        Update: {
          blurhash?: string | null
          caption?: string
          created_at?: string
          date_precision?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          is_favorite?: boolean
          kind?: string
          mime?: string
          owner_id?: string
          owner_table?: string
          rel_path?: string | null
          remote_path?: string | null
          remote_thumb_path?: string | null
          server_updated_at?: string
          size_bytes?: number | null
          source?: string
          taken_at?: string | null
          thumb_rel_path?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      milestone: {
        Row: {
          cost_dop: number | null
          cover_media_id: string | null
          created_at: string
          deleted_at: string | null
          event_type: string
          id: string
          kind: string
          linked_inspection_id: string | null
          linked_mod_id: string | null
          linked_service_id: string | null
          location_label: string
          occurred_at: string
          odometer_km: number | null
          pending: string
          resolved_at: string | null
          server_updated_at: string
          severity: string | null
          story: string
          title: string
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          cost_dop?: number | null
          cover_media_id?: string | null
          created_at: string
          deleted_at?: string | null
          event_type?: string
          id: string
          kind: string
          linked_inspection_id?: string | null
          linked_mod_id?: string | null
          linked_service_id?: string | null
          location_label?: string
          occurred_at: string
          odometer_km?: number | null
          pending?: string
          resolved_at?: string | null
          server_updated_at?: string
          severity?: string | null
          story?: string
          title: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
        }
        Update: {
          cost_dop?: number | null
          cover_media_id?: string | null
          created_at?: string
          deleted_at?: string | null
          event_type?: string
          id?: string
          kind?: string
          linked_inspection_id?: string | null
          linked_mod_id?: string | null
          linked_service_id?: string | null
          location_label?: string
          occurred_at?: string
          odometer_km?: number | null
          pending?: string
          resolved_at?: string | null
          server_updated_at?: string
          severity?: string | null
          story?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      mod: {
        Row: {
          affects_specs: boolean
          brand: string | null
          category_id: string
          contact_id: string | null
          cost_customs_dop: number
          cost_labor_dop: number
          cost_part_dop: number
          cost_shipping_dop: number
          created_at: string
          currency: string | null
          deleted_at: string | null
          fx_rate_to_dop: number | null
          id: string
          installed_at: string | null
          installed_km: number | null
          installer_type: string
          name: string
          notes: string
          part_number: string | null
          price_foreign: number | null
          removed_at: string | null
          removed_km: number | null
          replaces_mod_id: string | null
          server_updated_at: string
          service_record_id: string | null
          sold_price_dop: number | null
          sold_to: string | null
          spec_effects: string
          status: string
          tags: string
          updated_at: string
          updated_by: string | null
          user_id: string
          variant: string | null
          vehicle_id: string
          vendor: string | null
          vendor_url: string | null
        }
        Insert: {
          affects_specs?: boolean
          brand?: string | null
          category_id: string
          contact_id?: string | null
          cost_customs_dop?: number
          cost_labor_dop?: number
          cost_part_dop?: number
          cost_shipping_dop?: number
          created_at: string
          currency?: string | null
          deleted_at?: string | null
          fx_rate_to_dop?: number | null
          id: string
          installed_at?: string | null
          installed_km?: number | null
          installer_type?: string
          name: string
          notes?: string
          part_number?: string | null
          price_foreign?: number | null
          removed_at?: string | null
          removed_km?: number | null
          replaces_mod_id?: string | null
          server_updated_at?: string
          service_record_id?: string | null
          sold_price_dop?: number | null
          sold_to?: string | null
          spec_effects?: string
          status?: string
          tags?: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
          variant?: string | null
          vehicle_id: string
          vendor?: string | null
          vendor_url?: string | null
        }
        Update: {
          affects_specs?: boolean
          brand?: string | null
          category_id?: string
          contact_id?: string | null
          cost_customs_dop?: number
          cost_labor_dop?: number
          cost_part_dop?: number
          cost_shipping_dop?: number
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          fx_rate_to_dop?: number | null
          id?: string
          installed_at?: string | null
          installed_km?: number | null
          installer_type?: string
          name?: string
          notes?: string
          part_number?: string | null
          price_foreign?: number | null
          removed_at?: string | null
          removed_km?: number | null
          replaces_mod_id?: string | null
          server_updated_at?: string
          service_record_id?: string | null
          sold_price_dop?: number | null
          sold_to?: string | null
          spec_effects?: string
          status?: string
          tags?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          variant?: string | null
          vehicle_id?: string
          vendor?: string | null
          vendor_url?: string | null
        }
        Relationships: []
      }
      mod_category: {
        Row: {
          created_at: string
          deleted_at: string | null
          icon: string | null
          id: string
          is_seeded: boolean
          name: string
          server_updated_at: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          icon?: string | null
          id: string
          is_seeded?: boolean
          name: string
          server_updated_at?: string
          sort_order?: number
          updated_at: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
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
      mod_media: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          media_id: string
          mod_id: string
          role: string
          server_updated_at: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          id: string
          media_id: string
          mod_id: string
          role?: string
          server_updated_at?: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          media_id?: string
          mod_id?: string
          role?: string
          server_updated_at?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_id: string | null
          avatar_path: string | null
          created_at: string
          deletion_objects: Json | null
          deletion_requested_at: string | null
          display_name: string | null
          locale: string | null
          media_quota_bytes: number
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          avatar_path?: string | null
          created_at?: string
          deletion_objects?: Json | null
          deletion_requested_at?: string | null
          display_name?: string | null
          locale?: string | null
          media_quota_bytes?: number
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          avatar_path?: string | null
          created_at?: string
          deletion_objects?: Json | null
          deletion_requested_at?: string | null
          display_name?: string | null
          locale?: string | null
          media_quota_bytes?: number
          role?: string
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      service_record: {
        Row: {
          contact_id: string | null
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
          updated_by: string | null
          user_id: string
          vehicle_id: string
          warranty_until_date: string | null
          warranty_until_km: number | null
        }
        Insert: {
          contact_id?: string | null
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
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
          warranty_until_date?: string | null
          warranty_until_km?: number | null
        }
        Update: {
          contact_id?: string | null
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
          updated_by?: string | null
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
          oil_brand: string | null
          oil_spec: string | null
          oil_type: string | null
          oil_viscosity: string | null
          server_updated_at: string
          service_record_id: string
          service_type_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          id: string
          notes?: string
          oil_brand?: string | null
          oil_spec?: string | null
          oil_type?: string | null
          oil_viscosity?: string | null
          server_updated_at?: string
          service_record_id: string
          service_type_id: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string
          oil_brand?: string | null
          oil_spec?: string | null
          oil_type?: string | null
          oil_viscosity?: string | null
          server_updated_at?: string
          service_record_id?: string
          service_type_id?: string
          updated_at?: string
          updated_by?: string | null
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
      setup_sheet: {
        Row: {
          brake_bias: string | null
          bump_f: number | null
          bump_r: number | null
          camber_fl: number | null
          camber_fr: number | null
          camber_rl: number | null
          camber_rr: number | null
          caster_l: number | null
          caster_r: number | null
          changed_from_previous: string
          clicks_total: number | null
          compound_f: string | null
          compound_r: string | null
          created_at: string
          deleted_at: string | null
          hydro: boolean
          id: string
          lsd_preload: string | null
          lsd_type: string | null
          pad_f: string | null
          pad_r: string | null
          psi_cold_fl: number | null
          psi_cold_fr: number | null
          psi_cold_rl: number | null
          psi_cold_rr: number | null
          psi_hot_fl: number | null
          psi_hot_fr: number | null
          psi_hot_rl: number | null
          psi_hot_rr: number | null
          rebound_f: number | null
          rebound_r: number | null
          rev_limit_rpm: number | null
          rh_fl_mm: number | null
          rh_fr_mm: number | null
          rh_rl_mm: number | null
          rh_rr_mm: number | null
          server_updated_at: string
          session_id: string
          spring_f: number | null
          spring_r: number | null
          spring_unit: string
          steering_angle_deg: number | null
          swaybar_f: string | null
          swaybar_r: string | null
          tire_set_f_id: string | null
          tire_set_r_id: string | null
          tire_size_f: string | null
          tire_size_r: string | null
          toe_f_mm: number | null
          toe_r_mm: number | null
          two_step_rpm: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          brake_bias?: string | null
          bump_f?: number | null
          bump_r?: number | null
          camber_fl?: number | null
          camber_fr?: number | null
          camber_rl?: number | null
          camber_rr?: number | null
          caster_l?: number | null
          caster_r?: number | null
          changed_from_previous?: string
          clicks_total?: number | null
          compound_f?: string | null
          compound_r?: string | null
          created_at: string
          deleted_at?: string | null
          hydro?: boolean
          id: string
          lsd_preload?: string | null
          lsd_type?: string | null
          pad_f?: string | null
          pad_r?: string | null
          psi_cold_fl?: number | null
          psi_cold_fr?: number | null
          psi_cold_rl?: number | null
          psi_cold_rr?: number | null
          psi_hot_fl?: number | null
          psi_hot_fr?: number | null
          psi_hot_rl?: number | null
          psi_hot_rr?: number | null
          rebound_f?: number | null
          rebound_r?: number | null
          rev_limit_rpm?: number | null
          rh_fl_mm?: number | null
          rh_fr_mm?: number | null
          rh_rl_mm?: number | null
          rh_rr_mm?: number | null
          server_updated_at?: string
          session_id: string
          spring_f?: number | null
          spring_r?: number | null
          spring_unit?: string
          steering_angle_deg?: number | null
          swaybar_f?: string | null
          swaybar_r?: string | null
          tire_set_f_id?: string | null
          tire_set_r_id?: string | null
          tire_size_f?: string | null
          tire_size_r?: string | null
          toe_f_mm?: number | null
          toe_r_mm?: number | null
          two_step_rpm?: number | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
        }
        Update: {
          brake_bias?: string | null
          bump_f?: number | null
          bump_r?: number | null
          camber_fl?: number | null
          camber_fr?: number | null
          camber_rl?: number | null
          camber_rr?: number | null
          caster_l?: number | null
          caster_r?: number | null
          changed_from_previous?: string
          clicks_total?: number | null
          compound_f?: string | null
          compound_r?: string | null
          created_at?: string
          deleted_at?: string | null
          hydro?: boolean
          id?: string
          lsd_preload?: string | null
          lsd_type?: string | null
          pad_f?: string | null
          pad_r?: string | null
          psi_cold_fl?: number | null
          psi_cold_fr?: number | null
          psi_cold_rl?: number | null
          psi_cold_rr?: number | null
          psi_hot_fl?: number | null
          psi_hot_fr?: number | null
          psi_hot_rl?: number | null
          psi_hot_rr?: number | null
          rebound_f?: number | null
          rebound_r?: number | null
          rev_limit_rpm?: number | null
          rh_fl_mm?: number | null
          rh_fr_mm?: number | null
          rh_rl_mm?: number | null
          rh_rr_mm?: number | null
          server_updated_at?: string
          session_id?: string
          spring_f?: number | null
          spring_r?: number | null
          spring_unit?: string
          steering_angle_deg?: number | null
          swaybar_f?: string | null
          swaybar_r?: string | null
          tire_set_f_id?: string | null
          tire_set_r_id?: string | null
          tire_size_f?: string | null
          tire_size_r?: string | null
          toe_f_mm?: number | null
          toe_r_mm?: number | null
          two_step_rpm?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      spec_snapshot: {
        Row: {
          as_of: string
          cover_media_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          server_updated_at: string
          specs: string
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          as_of: string
          cover_media_id?: string | null
          created_at: string
          deleted_at?: string | null
          id: string
          label: string
          server_updated_at?: string
          specs?: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
        }
        Update: {
          as_of?: string
          cover_media_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          server_updated_at?: string
          specs?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      tire: {
        Row: {
          aspect: number | null
          brand: string | null
          compound: string | null
          cost_dop: number | null
          created_at: string
          deleted_at: string | null
          dot_code: string | null
          dot_week: number | null
          dot_year: number | null
          heat_cycles: number
          id: string
          load_index: string | null
          model: string | null
          position: string
          purchased_at: string | null
          rim_in: number | null
          server_updated_at: string
          size: string | null
          speed_rating: string | null
          status: string
          tread_mm_current: number | null
          tread_mm_new: number | null
          treadwear: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
          wheel_set_id: string | null
          width_mm: number | null
        }
        Insert: {
          aspect?: number | null
          brand?: string | null
          compound?: string | null
          cost_dop?: number | null
          created_at: string
          deleted_at?: string | null
          dot_code?: string | null
          dot_week?: number | null
          dot_year?: number | null
          heat_cycles?: number
          id: string
          load_index?: string | null
          model?: string | null
          position?: string
          purchased_at?: string | null
          rim_in?: number | null
          server_updated_at?: string
          size?: string | null
          speed_rating?: string | null
          status?: string
          tread_mm_current?: number | null
          tread_mm_new?: number | null
          treadwear?: number | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
          wheel_set_id?: string | null
          width_mm?: number | null
        }
        Update: {
          aspect?: number | null
          brand?: string | null
          compound?: string | null
          cost_dop?: number | null
          created_at?: string
          deleted_at?: string | null
          dot_code?: string | null
          dot_week?: number | null
          dot_year?: number | null
          heat_cycles?: number
          id?: string
          load_index?: string | null
          model?: string | null
          position?: string
          purchased_at?: string | null
          rim_in?: number | null
          server_updated_at?: string
          size?: string | null
          speed_rating?: string | null
          status?: string
          tread_mm_current?: number | null
          tread_mm_new?: number | null
          treadwear?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
          wheel_set_id?: string | null
          width_mm?: number | null
        }
        Relationships: []
      }
      torque_spec: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          item: string
          media_id: string | null
          notes: string
          server_updated_at: string
          source: string | null
          stage: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          value_nm: number
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          id: string
          item: string
          media_id?: string | null
          notes?: string
          server_updated_at?: string
          source?: string | null
          stage?: string | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          value_nm: number
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item?: string
          media_id?: string | null
          notes?: string
          server_updated_at?: string
          source?: string | null
          stage?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          value_nm?: number
          vehicle_id?: string
        }
        Relationships: []
      }
      track_event: {
        Row: {
          ambient_c: number | null
          created_at: string
          deleted_at: string | null
          discipline: string
          entry_fee_dop: number | null
          fuel_cost_dop: number | null
          id: string
          layout: string | null
          notes: string
          occurred_at: string
          odometer_end_km: number | null
          odometer_start_km: number | null
          organizer: string | null
          other_cost_dop: number | null
          server_updated_at: string
          title: string
          track_condition: string | null
          track_temp_c: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
          venue_id: string | null
          weather: string | null
        }
        Insert: {
          ambient_c?: number | null
          created_at: string
          deleted_at?: string | null
          discipline?: string
          entry_fee_dop?: number | null
          fuel_cost_dop?: number | null
          id: string
          layout?: string | null
          notes?: string
          occurred_at: string
          odometer_end_km?: number | null
          odometer_start_km?: number | null
          organizer?: string | null
          other_cost_dop?: number | null
          server_updated_at?: string
          title?: string
          track_condition?: string | null
          track_temp_c?: number | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
          venue_id?: string | null
          weather?: string | null
        }
        Update: {
          ambient_c?: number | null
          created_at?: string
          deleted_at?: string | null
          discipline?: string
          entry_fee_dop?: number | null
          fuel_cost_dop?: number | null
          id?: string
          layout?: string | null
          notes?: string
          occurred_at?: string
          odometer_end_km?: number | null
          odometer_start_km?: number | null
          organizer?: string | null
          other_cost_dop?: number | null
          server_updated_at?: string
          title?: string
          track_condition?: string | null
          track_temp_c?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
          venue_id?: string | null
          weather?: string | null
        }
        Relationships: []
      }
      track_session: {
        Row: {
          ballast_kg: number | null
          best_lap_ms: number | null
          car_feel: string | null
          created_at: string
          deleted_at: string | null
          driver: string | null
          duration_min: number | null
          event_id: string
          fuel_load_l: number | null
          id: string
          incident: string | null
          kind: string
          laps: number | null
          notes: string
          passenger: boolean
          quarter_mile_ms: number | null
          quarter_mile_trap_kmh: number | null
          rating: number | null
          runs: number | null
          second_best_ms: number | null
          sectors_ms: string
          seq: number
          server_updated_at: string
          sixty_foot_ms: number | null
          started_at: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          video_url: string | null
          zero_100_ms: number | null
        }
        Insert: {
          ballast_kg?: number | null
          best_lap_ms?: number | null
          car_feel?: string | null
          created_at: string
          deleted_at?: string | null
          driver?: string | null
          duration_min?: number | null
          event_id: string
          fuel_load_l?: number | null
          id: string
          incident?: string | null
          kind?: string
          laps?: number | null
          notes?: string
          passenger?: boolean
          quarter_mile_ms?: number | null
          quarter_mile_trap_kmh?: number | null
          rating?: number | null
          runs?: number | null
          second_best_ms?: number | null
          sectors_ms?: string
          seq: number
          server_updated_at?: string
          sixty_foot_ms?: number | null
          started_at?: string | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          video_url?: string | null
          zero_100_ms?: number | null
        }
        Update: {
          ballast_kg?: number | null
          best_lap_ms?: number | null
          car_feel?: string | null
          created_at?: string
          deleted_at?: string | null
          driver?: string | null
          duration_min?: number | null
          event_id?: string
          fuel_load_l?: number | null
          id?: string
          incident?: string | null
          kind?: string
          laps?: number | null
          notes?: string
          passenger?: boolean
          quarter_mile_ms?: number | null
          quarter_mile_trap_kmh?: number | null
          rating?: number | null
          runs?: number | null
          second_best_ms?: number | null
          sectors_ms?: string
          seq?: number
          server_updated_at?: string
          sixty_foot_ms?: number | null
          started_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          video_url?: string | null
          zero_100_ms?: number | null
        }
        Relationships: []
      }
      trip: {
        Row: {
          avg_kmh: number | null
          avg_moving_kmh: number | null
          bbox: string | null
          created_at: string
          deleted_at: string | null
          diagnostics: string | null
          distance_m: number
          duration_s: number
          end_label: string
          end_lat: number | null
          end_lng: number | null
          ended_at: string | null
          id: string
          max_kmh: number | null
          moving_s: number
          notes: string
          odometer_reading_id: string | null
          polyline: string | null
          role: string
          schema_hint: string | null
          segments: number
          server_updated_at: string
          source: string
          speed_buckets: string
          start_label: string
          start_lat: number | null
          start_lng: number | null
          started_at: string
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          avg_kmh?: number | null
          avg_moving_kmh?: number | null
          bbox?: string | null
          created_at: string
          deleted_at?: string | null
          diagnostics?: string | null
          distance_m?: number
          duration_s?: number
          end_label?: string
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id: string
          max_kmh?: number | null
          moving_s?: number
          notes?: string
          odometer_reading_id?: string | null
          polyline?: string | null
          role?: string
          schema_hint?: string | null
          segments?: number
          server_updated_at?: string
          source: string
          speed_buckets?: string
          start_label?: string
          start_lat?: number | null
          start_lng?: number | null
          started_at: string
          status: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
        }
        Update: {
          avg_kmh?: number | null
          avg_moving_kmh?: number | null
          bbox?: string | null
          created_at?: string
          deleted_at?: string | null
          diagnostics?: string | null
          distance_m?: number
          duration_s?: number
          end_label?: string
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id?: string
          max_kmh?: number | null
          moving_s?: number
          notes?: string
          odometer_reading_id?: string | null
          polyline?: string | null
          role?: string
          schema_hint?: string | null
          segments?: number
          server_updated_at?: string
          source?: string
          speed_buckets?: string
          start_label?: string
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle: {
        Row: {
          body_type: string | null
          chassis_code: string | null
          chassis_number: string | null
          color: string | null
          color_id: string | null
          created_at: string
          default_fuel_type: string
          deleted_at: string | null
          drivetrain: string | null
          economy_unit: string
          engine_code: string | null
          hero_media_id: string | null
          id: string
          imported_year: number | null
          initial_odometer_km: number | null
          interior_color_id: string | null
          interior_material: string | null
          is_archived: boolean
          limit_kmh: number
          make: string | null
          make_id: string | null
          model: string | null
          model_id: string | null
          name: string
          nickname: string | null
          notes: string
          origin: string | null
          photo_media_id: string | null
          plate: string | null
          purchase_date: string | null
          purchase_price: number | null
          reserve_volume_l: number | null
          schema_hint: string | null
          server_updated_at: string
          sold_date: string | null
          sold_price: number | null
          sort_order: number
          status: string
          status_note: string
          status_since: string | null
          story: string
          tank_l: number | null
          tank_volume: number | null
          tank_volume_entered: number | null
          transmission: string | null
          trim: string | null
          trip_mode: string
          type: string
          updated_at: string
          updated_by: string | null
          user_id: string
          vin: string | null
          volume_unit: string
          year: number | null
        }
        Insert: {
          body_type?: string | null
          chassis_code?: string | null
          chassis_number?: string | null
          color?: string | null
          color_id?: string | null
          created_at: string
          default_fuel_type: string
          deleted_at?: string | null
          drivetrain?: string | null
          economy_unit?: string
          engine_code?: string | null
          hero_media_id?: string | null
          id: string
          imported_year?: number | null
          initial_odometer_km?: number | null
          interior_color_id?: string | null
          interior_material?: string | null
          is_archived?: boolean
          limit_kmh?: number
          make?: string | null
          make_id?: string | null
          model?: string | null
          model_id?: string | null
          name: string
          nickname?: string | null
          notes?: string
          origin?: string | null
          photo_media_id?: string | null
          plate?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          reserve_volume_l?: number | null
          schema_hint?: string | null
          server_updated_at?: string
          sold_date?: string | null
          sold_price?: number | null
          sort_order?: number
          status?: string
          status_note?: string
          status_since?: string | null
          story?: string
          tank_l?: number | null
          tank_volume?: number | null
          tank_volume_entered?: number | null
          transmission?: string | null
          trim?: string | null
          trip_mode?: string
          type?: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vin?: string | null
          volume_unit?: string
          year?: number | null
        }
        Update: {
          body_type?: string | null
          chassis_code?: string | null
          chassis_number?: string | null
          color?: string | null
          color_id?: string | null
          created_at?: string
          default_fuel_type?: string
          deleted_at?: string | null
          drivetrain?: string | null
          economy_unit?: string
          engine_code?: string | null
          hero_media_id?: string | null
          id?: string
          imported_year?: number | null
          initial_odometer_km?: number | null
          interior_color_id?: string | null
          interior_material?: string | null
          is_archived?: boolean
          limit_kmh?: number
          make?: string | null
          make_id?: string | null
          model?: string | null
          model_id?: string | null
          name?: string
          nickname?: string | null
          notes?: string
          origin?: string | null
          photo_media_id?: string | null
          plate?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          reserve_volume_l?: number | null
          schema_hint?: string | null
          server_updated_at?: string
          sold_date?: string | null
          sold_price?: number | null
          sort_order?: number
          status?: string
          status_note?: string
          status_since?: string | null
          story?: string
          tank_l?: number | null
          tank_volume?: number | null
          tank_volume_entered?: number | null
          transmission?: string | null
          trim?: string | null
          trip_mode?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vin?: string | null
          volume_unit?: string
          year?: number | null
        }
        Relationships: []
      }
      vehicle_dtc_event: {
        Row: {
          cleared_at: string | null
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          notes: string
          odometer_km: number | null
          repair_record_id: string | null
          seen_at: string
          server_updated_at: string
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          cleared_at?: string | null
          code: string
          created_at: string
          deleted_at?: string | null
          id: string
          notes?: string
          odometer_km?: number | null
          repair_record_id?: string | null
          seen_at: string
          server_updated_at?: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
        }
        Update: {
          cleared_at?: string | null
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string
          odometer_km?: number | null
          repair_record_id?: string | null
          seen_at?: string
          server_updated_at?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_fact: {
        Row: {
          created_at: string
          deleted_at: string | null
          group_name: string
          id: string
          label: string
          server_updated_at: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          user_id: string
          value: string
          vehicle_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          group_name?: string
          id: string
          label: string
          server_updated_at?: string
          sort_order?: number
          updated_at: string
          updated_by?: string | null
          user_id?: string
          value: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          group_name?: string
          id?: string
          label?: string
          server_updated_at?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          value?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_invite: {
        Row: {
          code: string
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          role: string
          used_at: string | null
          used_by: string | null
          vehicle_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          role?: string
          used_at?: string | null
          used_by?: string | null
          vehicle_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          role?: string
          used_at?: string | null
          used_by?: string | null
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_member: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string | null
          role: string
          server_updated_at: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string | null
          role: string
          server_updated_at?: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string | null
          role?: string
          server_updated_at?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_ownership: {
        Row: {
          acquired_at: string | null
          acquired_from: string | null
          acquired_km: number | null
          acquired_price: number | null
          created_at: string
          deleted_at: string | null
          id: string
          is_current: boolean
          reason: string | null
          server_updated_at: string
          sold_at: string | null
          sold_km: number | null
          sold_price: number | null
          sold_to: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          acquired_at?: string | null
          acquired_from?: string | null
          acquired_km?: number | null
          acquired_price?: number | null
          created_at: string
          deleted_at?: string | null
          id: string
          is_current?: boolean
          reason?: string | null
          server_updated_at?: string
          sold_at?: string | null
          sold_km?: number | null
          sold_price?: number | null
          sold_to?: string | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
        }
        Update: {
          acquired_at?: string | null
          acquired_from?: string | null
          acquired_km?: number | null
          acquired_price?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_current?: boolean
          reason?: string | null
          server_updated_at?: string
          sold_at?: string | null
          sold_km?: number | null
          sold_price?: number | null
          sold_to?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_share: {
        Row: {
          costs_summary: string | null
          created_at: string
          deleted_at: string | null
          id: string
          og_media_id: string | null
          published_at: string | null
          revoked_at: string | null
          server_updated_at: string
          show_costs: boolean
          show_docs: boolean
          show_location: boolean
          show_maintenance: boolean
          show_mods: boolean
          show_odometer: boolean
          show_plate: boolean
          show_status: boolean
          show_story: boolean
          show_tires: boolean
          show_track: boolean
          show_vin: boolean
          slug: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
          visibility: string
        }
        Insert: {
          costs_summary?: string | null
          created_at: string
          deleted_at?: string | null
          id: string
          og_media_id?: string | null
          published_at?: string | null
          revoked_at?: string | null
          server_updated_at?: string
          show_costs?: boolean
          show_docs?: boolean
          show_location?: boolean
          show_maintenance?: boolean
          show_mods?: boolean
          show_odometer?: boolean
          show_plate?: boolean
          show_status?: boolean
          show_story?: boolean
          show_tires?: boolean
          show_track?: boolean
          show_vin?: boolean
          slug?: string | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
          visibility?: string
        }
        Update: {
          costs_summary?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          og_media_id?: string | null
          published_at?: string | null
          revoked_at?: string | null
          server_updated_at?: string
          show_costs?: boolean
          show_docs?: boolean
          show_location?: boolean
          show_maintenance?: boolean
          show_mods?: boolean
          show_odometer?: boolean
          show_plate?: boolean
          show_status?: boolean
          show_story?: boolean
          show_tires?: boolean
          show_track?: boolean
          show_vin?: boolean
          slug?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
          visibility?: string
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
          user_id?: string
          value?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_specsheet: {
        Row: {
          air_filter_pn: string | null
          battery_brand: string | null
          battery_spec: string | null
          bolt_pattern: string | null
          brake_fluid: string | null
          bulb_high: string | null
          bulb_low: string | null
          cabin_filter_pn: string | null
          center_bore_mm: number | null
          coolant_capacity_l: number | null
          coolant_type: string | null
          created_at: string
          deleted_at: string | null
          diff_oil_l: number | null
          diff_oil_spec: string | null
          field_sources: string
          fuel_filter_pn: string | null
          fuel_octane: number | null
          fuel_tank_l: number | null
          id: string
          lug_thread: string | null
          lug_torque_nm: number | null
          oil_brand: string | null
          oil_capacity_filter_l: number | null
          oil_capacity_l: number | null
          oil_filter_brand: string | null
          oil_filter_pn: string | null
          oil_grade: string | null
          oil_product: string | null
          oil_spec: string | null
          overrides: string
          plug_gap_mm: number | null
          preset_id: string | null
          ps_fluid: string | null
          psi_oem_f: number | null
          psi_oem_r: number | null
          server_updated_at: string
          spark_plug_pn: string | null
          stock: string
          tire_current_f: string | null
          tire_current_r: string | null
          tire_size_oem_f: string | null
          tire_size_oem_r: string | null
          trans_oil_l: number | null
          trans_oil_spec: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
          verified_fields: string
          where_bought: string
          wiper_sizes: string | null
        }
        Insert: {
          air_filter_pn?: string | null
          battery_brand?: string | null
          battery_spec?: string | null
          bolt_pattern?: string | null
          brake_fluid?: string | null
          bulb_high?: string | null
          bulb_low?: string | null
          cabin_filter_pn?: string | null
          center_bore_mm?: number | null
          coolant_capacity_l?: number | null
          coolant_type?: string | null
          created_at: string
          deleted_at?: string | null
          diff_oil_l?: number | null
          diff_oil_spec?: string | null
          field_sources?: string
          fuel_filter_pn?: string | null
          fuel_octane?: number | null
          fuel_tank_l?: number | null
          id: string
          lug_thread?: string | null
          lug_torque_nm?: number | null
          oil_brand?: string | null
          oil_capacity_filter_l?: number | null
          oil_capacity_l?: number | null
          oil_filter_brand?: string | null
          oil_filter_pn?: string | null
          oil_grade?: string | null
          oil_product?: string | null
          oil_spec?: string | null
          overrides?: string
          plug_gap_mm?: number | null
          preset_id?: string | null
          ps_fluid?: string | null
          psi_oem_f?: number | null
          psi_oem_r?: number | null
          server_updated_at?: string
          spark_plug_pn?: string | null
          stock?: string
          tire_current_f?: string | null
          tire_current_r?: string | null
          tire_size_oem_f?: string | null
          tire_size_oem_r?: string | null
          trans_oil_l?: number | null
          trans_oil_spec?: string | null
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
          verified_fields?: string
          where_bought?: string
          wiper_sizes?: string | null
        }
        Update: {
          air_filter_pn?: string | null
          battery_brand?: string | null
          battery_spec?: string | null
          bolt_pattern?: string | null
          brake_fluid?: string | null
          bulb_high?: string | null
          bulb_low?: string | null
          cabin_filter_pn?: string | null
          center_bore_mm?: number | null
          coolant_capacity_l?: number | null
          coolant_type?: string | null
          created_at?: string
          deleted_at?: string | null
          diff_oil_l?: number | null
          diff_oil_spec?: string | null
          field_sources?: string
          fuel_filter_pn?: string | null
          fuel_octane?: number | null
          fuel_tank_l?: number | null
          id?: string
          lug_thread?: string | null
          lug_torque_nm?: number | null
          oil_brand?: string | null
          oil_capacity_filter_l?: number | null
          oil_capacity_l?: number | null
          oil_filter_brand?: string | null
          oil_filter_pn?: string | null
          oil_grade?: string | null
          oil_product?: string | null
          oil_spec?: string | null
          overrides?: string
          plug_gap_mm?: number | null
          preset_id?: string | null
          ps_fluid?: string | null
          psi_oem_f?: number | null
          psi_oem_r?: number | null
          server_updated_at?: string
          spark_plug_pn?: string | null
          stock?: string
          tire_current_f?: string | null
          tire_current_r?: string | null
          tire_size_oem_f?: string | null
          tire_size_oem_r?: string | null
          trans_oil_l?: number | null
          trans_oil_spec?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
          verified_fields?: string
          where_bought?: string
          wiper_sizes?: string | null
        }
        Relationships: []
      }
      venue: {
        Row: {
          city: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_seeded: boolean
          lat: number | null
          layout: string | null
          length_m: number | null
          lng: number | null
          name: string
          notes: string
          server_updated_at: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at: string
          deleted_at?: string | null
          id: string
          is_seeded?: boolean
          lat?: number | null
          layout?: string | null
          length_m?: number | null
          lng?: number | null
          name: string
          notes?: string
          server_updated_at?: string
          type?: string
          updated_at: string
          user_id?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_seeded?: boolean
          lat?: number | null
          layout?: string | null
          length_m?: number | null
          lng?: number | null
          name?: string
          notes?: string
          server_updated_at?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wheel_set: {
        Row: {
          bolt_pattern: string | null
          brand: string | null
          center_bore_mm: number | null
          created_at: string
          deleted_at: string | null
          diam_in: number | null
          id: string
          media_id: string | null
          model: string | null
          name: string
          notes: string
          offset_mm: number | null
          position_pref: string
          qty: number
          server_updated_at: string
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
          vehicle_id: string
          width_in: number | null
        }
        Insert: {
          bolt_pattern?: string | null
          brand?: string | null
          center_bore_mm?: number | null
          created_at: string
          deleted_at?: string | null
          diam_in?: number | null
          id: string
          media_id?: string | null
          model?: string | null
          name: string
          notes?: string
          offset_mm?: number | null
          position_pref?: string
          qty?: number
          server_updated_at?: string
          status?: string
          updated_at: string
          updated_by?: string | null
          user_id?: string
          vehicle_id: string
          width_in?: number | null
        }
        Update: {
          bolt_pattern?: string | null
          brand?: string | null
          center_bore_mm?: number | null
          created_at?: string
          deleted_at?: string | null
          diam_in?: number | null
          id?: string
          media_id?: string | null
          model?: string | null
          name?: string
          notes?: string
          offset_mm?: number | null
          position_pref?: string
          qty?: number
          server_updated_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          vehicle_id?: string
          width_in?: number | null
        }
        Relationships: []
      }
      wishlist_item: {
        Row: {
          brand: string | null
          category_id: string | null
          converted_mod_id: string | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          est_customs_dop: number | null
          est_price_foreign: number | null
          est_shipping_dop: number | null
          est_total_dop: number | null
          id: string
          name: string
          notes: string
          part_number: string | null
          priority: number
          server_updated_at: string
          status: string
          target_date: string | null
          updated_at: string
          updated_by: string | null
          url: string | null
          user_id: string
          vehicle_id: string
          vendor: string | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          converted_mod_id?: string | null
          created_at: string
          currency?: string | null
          deleted_at?: string | null
          est_customs_dop?: number | null
          est_price_foreign?: number | null
          est_shipping_dop?: number | null
          est_total_dop?: number | null
          id: string
          name: string
          notes?: string
          part_number?: string | null
          priority?: number
          server_updated_at?: string
          status?: string
          target_date?: string | null
          updated_at: string
          updated_by?: string | null
          url?: string | null
          user_id?: string
          vehicle_id: string
          vendor?: string | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          converted_mod_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          est_customs_dop?: number | null
          est_price_foreign?: number | null
          est_shipping_dop?: number | null
          est_total_dop?: number | null
          id?: string
          name?: string
          notes?: string
          part_number?: string | null
          priority?: number
          server_updated_at?: string
          status?: string
          target_date?: string | null
          updated_at?: string
          updated_by?: string | null
          url?: string | null
          user_id?: string
          vehicle_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_pending_deletions: {
        Args: never
        Returns: {
          email: string
          last_sign_in_at: string
          objects: number
          requested_at: string
          user_id: string
        }[]
      }
      admin_set_role: {
        Args: { p_role: string; p_user: string }
        Returns: string
      }
      admin_stats: { Args: never; Returns: Json }
      admin_users: {
        Args: { p_limit?: number }
        Returns: {
          avatar_id: string
          created_at: string
          display_name: string
          email: string
          fuel_logs: number
          last_activity: string
          last_sign_in_at: string
          role: string
          trips: number
          user_id: string
          vehicles: number
        }[]
      }
      attach_feedback_screenshot: {
        Args: { p_device_id: string; p_id: string }
        Returns: boolean
      }
      can_edit: { Args: { row_user: string; v: string }; Returns: boolean }
      can_own: { Args: { row_user: string; v: string }; Returns: boolean }
      can_read_media_object: { Args: { object_name: string }; Returns: boolean }
      can_see: { Args: { row_user: string; v: string }; Returns: boolean }
      create_invite: {
        Args: { p_email?: string; p_role?: string; p_vehicle: string }
        Returns: string
      }
      delete_my_account: { Args: never; Returns: Json }
      feedback_upload_allowed: {
        Args: { object_name: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_app_user: { Args: never; Returns: boolean }
      is_member: { Args: { min_role?: string; v: string }; Returns: boolean }
      member_avatars: {
        Args: { p_vehicle: string }
        Returns: {
          avatar_id: string
          display_name: string
          user_id: string
        }[]
      }
      public_dossier: { Args: { p_slug: string }; Returns: Json }
      redeem_invite: { Args: { p_code: string }; Returns: Json }
      remove_member: {
        Args: { p_user: string; p_vehicle: string }
        Returns: boolean
      }
      set_member_role: {
        Args: { p_role: string; p_user: string; p_vehicle: string }
        Returns: boolean
      }
      storage_usage_bytes: { Args: never; Returns: number }
      submit_feedback: { Args: { p: Json }; Returns: string }
      upsert_fuel_price_ref: { Args: { rows: Json }; Returns: number }
      vehicle_of: { Args: { row_id: string; tbl: string }; Returns: string }
      vehicle_role: { Args: { v: string }; Returns: string }
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
