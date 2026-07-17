export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string;
          admin_id: string | null;
          created_at: string;
          entity: string | null;
          entity_id: string | null;
          id: string;
          payload: Json | null;
        };
        Insert: {
          action: string;
          admin_id?: string | null;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          payload?: Json | null;
        };
        Update: {
          action?: string;
          admin_id?: string | null;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          payload?: Json | null;
        };
        Relationships: [];
      };
      appointment_extras: {
        Row: {
          appointment_id: string;
          created_at: string;
          duration_minutes: number;
          extra_service_id: string;
          id: string;
          name_snapshot: string;
          price_cents: number;
        };
        Insert: {
          appointment_id: string;
          created_at?: string;
          duration_minutes?: number;
          extra_service_id: string;
          id?: string;
          name_snapshot: string;
          price_cents?: number;
        };
        Update: {
          appointment_id?: string;
          created_at?: string;
          duration_minutes?: number;
          extra_service_id?: string;
          id?: string;
          name_snapshot?: string;
          price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_extras_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_extras_extra_service_id_fkey";
            columns: ["extra_service_id"];
            isOneToOne: false;
            referencedRelation: "extra_services";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          arrival_order: number | null;
          created_at: string;
          estimated_minutes: number;
          finished_at: string | null;
          google_event_id: string | null;
          google_sync_status: string;
          id: string;
          notes: string | null;
          scheduled_at: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["appointment_status"];
          subscription_id: string | null;
          total_extras_cents: number;
          updated_at: string;
          user_id: string;
          vehicle_id: string | null;
        };
        Insert: {
          arrival_order?: number | null;
          created_at?: string;
          estimated_minutes?: number;
          finished_at?: string | null;
          google_event_id?: string | null;
          google_sync_status?: string;
          id?: string;
          notes?: string | null;
          scheduled_at: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["appointment_status"];
          subscription_id?: string | null;
          total_extras_cents?: number;
          updated_at?: string;
          user_id: string;
          vehicle_id?: string | null;
        };
        Update: {
          arrival_order?: number | null;
          created_at?: string;
          estimated_minutes?: number;
          finished_at?: string | null;
          google_event_id?: string | null;
          google_sync_status?: string;
          id?: string;
          notes?: string | null;
          scheduled_at?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["appointment_status"];
          subscription_id?: string | null;
          total_extras_cents?: number;
          updated_at?: string;
          user_id?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_profile_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_attempts: {
        Row: {
          action: string;
          created_at: string;
          email: string | null;
          id: string;
          ip: string | null;
          success: boolean;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          ip?: string | null;
          success?: boolean;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          ip?: string | null;
          success?: boolean;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      blocked_slots: {
        Row: {
          blocked_at: string;
          created_at: string;
          id: string;
          reason: string | null;
        };
        Insert: {
          blocked_at: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
        };
        Update: {
          blocked_at?: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
        };
        Relationships: [];
      };
      company_deletion_requests: {
        Row: {
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          executed_at: string | null;
          id: string;
          reason: string | null;
          requested_by: string;
          scheduled_for: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          executed_at?: string | null;
          id?: string;
          reason?: string | null;
          requested_by: string;
          scheduled_for: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          executed_at?: string | null;
          id?: string;
          reason?: string | null;
          requested_by?: string;
          scheduled_for?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_settings: {
        Row: {
          address: string | null;
          address_complement: string | null;
          address_number: string | null;
          allow_reschedule: boolean;
          allow_walkins: boolean;
          cancellation_deadline_hours: number;
          cep: string | null;
          city: string | null;
          cnpj: string | null;
          created_at: string;
          email: string | null;
          emergency_mode: boolean;
          emergency_mode_at: string | null;
          emergency_mode_by: string | null;
          emergency_mode_reason: string | null;
          facebook: string | null;
          id: string;
          instagram: string | null;
          legal_name: string | null;
          logo_url: string | null;
          min_booking_lead_minutes: number;
          notification_prefs: Json;
          phone: string | null;
          state: string | null;
          trade_name: string | null;
          updated_at: string;
          updated_by: string | null;
          website: string | null;
          whatsapp: string | null;
        };
        Insert: {
          address?: string | null;
          address_complement?: string | null;
          address_number?: string | null;
          allow_reschedule?: boolean;
          allow_walkins?: boolean;
          cancellation_deadline_hours?: number;
          cep?: string | null;
          city?: string | null;
          cnpj?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_mode?: boolean;
          emergency_mode_at?: string | null;
          emergency_mode_by?: string | null;
          emergency_mode_reason?: string | null;
          facebook?: string | null;
          id?: string;
          instagram?: string | null;
          legal_name?: string | null;
          logo_url?: string | null;
          min_booking_lead_minutes?: number;
          notification_prefs?: Json;
          phone?: string | null;
          state?: string | null;
          trade_name?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          website?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          address?: string | null;
          address_complement?: string | null;
          address_number?: string | null;
          allow_reschedule?: boolean;
          allow_walkins?: boolean;
          cancellation_deadline_hours?: number;
          cep?: string | null;
          city?: string | null;
          cnpj?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_mode?: boolean;
          emergency_mode_at?: string | null;
          emergency_mode_by?: string | null;
          emergency_mode_reason?: string | null;
          facebook?: string | null;
          id?: string;
          instagram?: string | null;
          legal_name?: string | null;
          logo_url?: string | null;
          min_booking_lead_minutes?: number;
          notification_prefs?: Json;
          phone?: string | null;
          state?: string | null;
          trade_name?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          website?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      data_deletion_requests: {
        Row: {
          admin_note: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          reason: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_note?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          reason?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_note?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          reason?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          expense_date: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          expense_date?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          expense_date?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      extra_services: {
        Row: {
          active: boolean;
          benefits: string[];
          created_at: string;
          description: string | null;
          duration_minutes: number;
          id: string;
          name: string;
          price_cents: number;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          benefits?: string[];
          created_at?: string;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          name: string;
          price_cents?: number;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          benefits?: string[];
          created_at?: string;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          name?: string;
          price_cents?: number;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      integration_connections: {
        Row: {
          connected_at: string | null;
          connected_by: string | null;
          created_at: string;
          encrypted_refresh_token: string | null;
          external_account_id: string | null;
          id: string;
          last_synced_at: string | null;
          metadata: Json;
          provider: string;
          scopes: string[];
          status: string;
          updated_at: string;
        };
        Insert: {
          connected_at?: string | null;
          connected_by?: string | null;
          created_at?: string;
          encrypted_refresh_token?: string | null;
          external_account_id?: string | null;
          id?: string;
          last_synced_at?: string | null;
          metadata?: Json;
          provider: string;
          scopes?: string[];
          status?: string;
          updated_at?: string;
        };
        Update: {
          connected_at?: string | null;
          connected_by?: string | null;
          created_at?: string;
          encrypted_refresh_token?: string | null;
          external_account_id?: string | null;
          id?: string;
          last_synced_at?: string | null;
          metadata?: Json;
          provider?: string;
          scopes?: string[];
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      integration_secrets: {
        Row: {
          created_at: string;
          encrypted_value: string;
          id: string;
          key_name: string;
          provider: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          encrypted_value: string;
          id?: string;
          key_name: string;
          provider: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          encrypted_value?: string;
          id?: string;
          key_name?: string;
          provider?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      integration_status: {
        Row: {
          created_at: string;
          id: string;
          is_enabled: boolean;
          last_checked_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          last_sync_at: string | null;
          metadata: Json;
          provider: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_enabled?: boolean;
          last_checked_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          last_sync_at?: string | null;
          metadata?: Json;
          provider: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_enabled?: boolean;
          last_checked_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          last_sync_at?: string | null;
          metadata?: Json;
          provider?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string;
          environment: string;
          expires_at: string;
          full_name: string | null;
          id: string;
          last_sent_at: string;
          plan_id: string | null;
          send_count: number;
          status: string;
          stripe_customer_id: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          token_hash: string;
          updated_at: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email: string;
          environment?: string;
          expires_at?: string;
          full_name?: string | null;
          id?: string;
          last_sent_at?: string;
          plan_id?: string | null;
          send_count?: number;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          token_hash: string;
          updated_at?: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string;
          environment?: string;
          expires_at?: string;
          full_name?: string | null;
          id?: string;
          last_sent_at?: string;
          plan_id?: string | null;
          send_count?: number;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          token_hash?: string;
          updated_at?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invites_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_webhook_events: {
        Row: {
          created_at: string;
          environment: string;
          error_message: string | null;
          event_id: string;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          provider: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          environment?: string;
          error_message?: string | null;
          event_id: string;
          event_type: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          environment?: string;
          error_message?: string | null;
          event_id?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          status?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          environment: string;
          external_ref: string | null;
          id: string;
          paid_at: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          stripe_event_id: string | null;
          stripe_invoice_id: string | null;
          stripe_payment_intent_id: string | null;
          subscription_id: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          environment?: string;
          external_ref?: string | null;
          id?: string;
          paid_at?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          stripe_event_id?: string | null;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          subscription_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          environment?: string;
          external_ref?: string | null;
          id?: string;
          paid_at?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          stripe_event_id?: string | null;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          subscription_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          benefits: string[];
          created_at: string;
          default_duration_minutes: number;
          id: string;
          monthly_price: number;
          name: string;
          stripe_price_id: string | null;
          washes_per_month: number;
        };
        Insert: {
          active?: boolean;
          benefits?: string[];
          created_at?: string;
          default_duration_minutes?: number;
          id?: string;
          monthly_price: number;
          name: string;
          stripe_price_id?: string | null;
          washes_per_month: number;
        };
        Update: {
          active?: boolean;
          benefits?: string[];
          created_at?: string;
          default_duration_minutes?: number;
          id?: string;
          monthly_price?: number;
          name?: string;
          stripe_price_id?: string | null;
          washes_per_month?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address: string | null;
          appearance_prefs: Json;
          approved_at: string | null;
          approved_by: string | null;
          avatar_url: string | null;
          blocked_at: string | null;
          blocked_by: string | null;
          blocked_reason: string | null;
          city: string | null;
          cpf: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          full_name: string;
          id: string;
          job_title: string | null;
          lgpd_consent_at: string | null;
          lgpd_consent_version: string | null;
          notes: string | null;
          phone: string | null;
          referral_source: string | null;
          rejection_reason: string | null;
          status: string;
          stripe_customer_id: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          appearance_prefs?: Json;
          approved_at?: string | null;
          approved_by?: string | null;
          avatar_url?: string | null;
          blocked_at?: string | null;
          blocked_by?: string | null;
          blocked_reason?: string | null;
          city?: string | null;
          cpf?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          full_name?: string;
          id: string;
          job_title?: string | null;
          lgpd_consent_at?: string | null;
          lgpd_consent_version?: string | null;
          notes?: string | null;
          phone?: string | null;
          referral_source?: string | null;
          rejection_reason?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          appearance_prefs?: Json;
          approved_at?: string | null;
          approved_by?: string | null;
          avatar_url?: string | null;
          blocked_at?: string | null;
          blocked_by?: string | null;
          blocked_reason?: string | null;
          city?: string | null;
          cpf?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          job_title?: string | null;
          lgpd_consent_at?: string | null;
          lgpd_consent_version?: string | null;
          notes?: string | null;
          phone?: string | null;
          referral_source?: string | null;
          rejection_reason?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      security_preferences: {
        Row: {
          alert_company_delete: boolean;
          alert_email_change: boolean;
          alert_login_attempts: boolean;
          alert_new_device: boolean;
          alert_new_login: boolean;
          alert_password_change: boolean;
          alert_plan_change: boolean;
          channel_dashboard: boolean;
          channel_email: boolean;
          channel_whatsapp: boolean;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alert_company_delete?: boolean;
          alert_email_change?: boolean;
          alert_login_attempts?: boolean;
          alert_new_device?: boolean;
          alert_new_login?: boolean;
          alert_password_change?: boolean;
          alert_plan_change?: boolean;
          channel_dashboard?: boolean;
          channel_email?: boolean;
          channel_whatsapp?: boolean;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alert_company_delete?: boolean;
          alert_email_change?: boolean;
          alert_login_attempts?: boolean;
          alert_new_device?: boolean;
          alert_new_login?: boolean;
          alert_password_change?: boolean;
          alert_plan_change?: boolean;
          channel_dashboard?: boolean;
          channel_email?: boolean;
          channel_whatsapp?: boolean;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          blocked_at: string | null;
          blocked_reason: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          environment: string;
          grace_period_ends_at: string | null;
          id: string;
          last_payment_event_id: string | null;
          next_due_date: string | null;
          plan_id: string;
          start_date: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_checkout_url: string | null;
          stripe_customer_id: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          user_id: string;
          washes_used: number;
        };
        Insert: {
          blocked_at?: string | null;
          blocked_reason?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          environment?: string;
          grace_period_ends_at?: string | null;
          id?: string;
          last_payment_event_id?: string | null;
          next_due_date?: string | null;
          plan_id: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_checkout_url?: string | null;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
          washes_used?: number;
        };
        Update: {
          blocked_at?: string | null;
          blocked_reason?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          environment?: string;
          grace_period_ends_at?: string | null;
          id?: string;
          last_payment_event_id?: string | null;
          next_due_date?: string | null;
          plan_id?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_checkout_url?: string | null;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
          washes_used?: number;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_profile_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          brand: string;
          color: string | null;
          created_at: string;
          id: string;
          image_status: string;
          image_url: string | null;
          mileage: number | null;
          model: string;
          notes: string | null;
          plate: string;
          user_id: string;
          year: number | null;
        };
        Insert: {
          brand: string;
          color?: string | null;
          created_at?: string;
          id?: string;
          image_status?: string;
          image_url?: string | null;
          mileage?: number | null;
          model: string;
          notes?: string | null;
          plate: string;
          user_id: string;
          year?: number | null;
        };
        Update: {
          brand?: string;
          color?: string | null;
          created_at?: string;
          id?: string;
          image_status?: string;
          image_url?: string | null;
          mileage?: number | null;
          model?: string;
          notes?: string | null;
          plate?: string;
          user_id?: string;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_profile_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bootstrap_admin_role: { Args: { _email: string }; Returns: string };
      check_auth_rate_limit: {
        Args: {
          _action: string;
          _email: string;
          _ip: string;
          _max_email?: number;
          _max_ip?: number;
          _window_minutes?: number;
        };
        Returns: {
          blocked: boolean;
          email_fails: number;
          ip_fails: number;
          retry_after_seconds: number;
        }[];
      };
      consume_invite_token: { Args: { _token_hash: string }; Returns: string };
      get_taken_slots: {
        Args: { _end: string; _start: string };
        Returns: {
          scheduled_at: string;
        }[];
      };
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_staff_role: { Args: { _user_id: string }; Returns: boolean };
      create_client_appointment: {
        Args: {
          _scheduled_at: string;
          _vehicle_id?: string | null;
          _extra_service_ids?: string[];
        };
        Returns: {
          appointment_id: string;
          scheduled_at: string;
          estimated_minutes: number;
          total_extras_cents: number;
        }[];
      };
      list_user_roles: {
        Args: { _user_id: string };
        Returns: {
          role: Database["public"]["Enums"]["app_role"];
        }[];
      };
      record_auth_attempt: {
        Args: {
          _action: string;
          _email: string;
          _ip: string;
          _success: boolean;
          _user_agent?: string;
        };
        Returns: undefined;
      };
      subscription_allows_access: {
        Args: { _subscription_id: string; _user_id: string };
        Returns: boolean;
      };
      validate_invite_token: {
        Args: { _token_hash: string };
        Returns: {
          email: string;
          expires_at: string;
          full_name: string;
          id: string;
          plan_id: string;
          status: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "client" | "manager" | "attendant" | "owner" | "operator";
      appointment_status: "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled";
      payment_status: "paid" | "pending" | "failed";
      subscription_status:
        | "active"
        | "expired"
        | "cancelled"
        | "pending"
        | "past_due"
        | "trialing"
        | "incomplete"
        | "unpaid";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client", "manager", "attendant", "owner", "operator"],
      appointment_status: ["scheduled", "confirmed", "in_progress", "completed", "cancelled"],
      payment_status: ["paid", "pending", "failed"],
      subscription_status: [
        "active",
        "expired",
        "cancelled",
        "pending",
        "past_due",
        "trialing",
        "incomplete",
        "unpaid",
      ],
    },
  },
} as const;
