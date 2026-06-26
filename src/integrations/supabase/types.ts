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
      ad_campaigns: {
        Row: {
          advertiser_id: string
          body: string | null
          budget_cents: number
          city: string | null
          clicks: number
          created_at: string
          cta_label: string | null
          cta_url: string | null
          ends_at: string
          id: string
          image_url: string | null
          impressions: number
          placement: string
          starts_at: string
          status: string
          target_event_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          body?: string | null
          budget_cents?: number
          city?: string | null
          clicks?: number
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at: string
          id?: string
          image_url?: string | null
          impressions?: number
          placement?: string
          starts_at?: string
          status?: string
          target_event_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          body?: string | null
          budget_cents?: number
          city?: string | null
          clicks?: number
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string
          id?: string
          image_url?: string | null
          impressions?: number
          placement?: string
          starts_at?: string
          status?: string
          target_event_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_target_event_id_fkey"
            columns: ["target_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_events: {
        Row: {
          campaign_id: string
          created_at: string
          id: number
          kind: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: number
          kind: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: number
          kind?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          body: string | null
          created_at: string
          id: number
          kind: string
          severity: string
          target_id: string | null
          target_table: string | null
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string | null
          created_at?: string
          id?: number
          kind: string
          severity?: string
          target_id?: string | null
          target_table?: string | null
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string | null
          created_at?: string
          id?: number
          kind?: string
          severity?: string
          target_id?: string | null
          target_table?: string | null
          title?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: number
          ip: unknown
          justification: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: number
          ip?: unknown
          justification?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: number
          ip?: unknown
          justification?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_ip_allowlist: {
        Row: {
          cidr: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
        }
        Insert: {
          cidr: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
        }
        Update: {
          cidr?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: number
          ip: unknown
          reason: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          ip?: unknown
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          ip?: unknown
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_mfa_status: {
        Row: {
          enrolled: boolean
          enrolled_at: string | null
          last_verified_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          enrolled?: boolean
          enrolled_at?: string | null
          last_verified_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          enrolled?: boolean
          enrolled_at?: string | null
          last_verified_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_sensitive_access_log: {
        Row: {
          actor_id: string
          created_at: string
          fields: string[]
          id: number
          ip: unknown
          justification: string
          kind: string
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          fields?: string[]
          id?: number
          ip?: unknown
          justification: string
          kind: string
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          fields?: string[]
          id?: number
          ip?: unknown
          justification?: string
          kind?: string
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      advertisers: {
        Row: {
          brand_name: string
          category: string
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          owner_id: string
          updated_at: string
          verified: boolean
          website: string | null
        }
        Insert: {
          brand_name: string
          category?: string
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          owner_id: string
          updated_at?: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          brand_name?: string
          category?: string
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
          verified?: boolean
          website?: string | null
        }
        Relationships: []
      }
      age_verifications: {
        Row: {
          created_at: string
          didit_session_id: string | null
          estimated_age: number | null
          id: string
          provider: string
          result: string
          status_raw: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          didit_session_id?: string | null
          estimated_age?: number | null
          id?: string
          provider?: string
          result: string
          status_raw?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          didit_session_id?: string | null
          estimated_age?: number | null
          id?: string
          provider?: string
          result?: string
          status_raw?: string | null
          user_id?: string
        }
        Relationships: []
      }
      album_requests: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          requester_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          requester_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          requester_id?: string
          status?: string
        }
        Relationships: []
      }
      album_unlocks: {
        Row: {
          granted_at: string
          id: string
          owner_id: string
          viewer_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          owner_id: string
          viewer_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          owner_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
          version: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
          version?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          version?: number
        }
        Relationships: []
      }
      app_settings_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          key: string
          value: Json
          version: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: number
          key: string
          value: Json
          version: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: number
          key?: string
          value?: Json
          version?: number
        }
        Relationships: []
      }
      banned_fingerprints: {
        Row: {
          banned_at: string
          banned_by: string | null
          fingerprint: string
          reason: string | null
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          fingerprint: string
          reason?: string | null
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          fingerprint?: string
          reason?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      breach_incidents: {
        Row: {
          affected_users_count: number | null
          authority_notified_at: string | null
          created_at: string
          created_by: string | null
          data_categories: string[] | null
          description: string | null
          discovered_at: string
          dpo_contact: string | null
          id: string
          notify_deadline: string
          status: string
          title: string
          users_notified_at: string | null
        }
        Insert: {
          affected_users_count?: number | null
          authority_notified_at?: string | null
          created_at?: string
          created_by?: string | null
          data_categories?: string[] | null
          description?: string | null
          discovered_at?: string
          dpo_contact?: string | null
          id?: string
          notify_deadline?: string
          status?: string
          title: string
          users_notified_at?: string | null
        }
        Update: {
          affected_users_count?: number | null
          authority_notified_at?: string | null
          created_at?: string
          created_by?: string | null
          data_categories?: string[] | null
          description?: string | null
          discovered_at?: string
          dpo_contact?: string | null
          id?: string
          notify_deadline?: string
          status?: string
          title?: string
          users_notified_at?: string | null
        }
        Relationships: []
      }
      business_applications: {
        Row: {
          accepts_dpa: boolean
          accepts_lgbt_charter: boolean
          accepts_terms: boolean
          address: string | null
          admin_notes: string | null
          brand_name: string | null
          category: string | null
          city: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          contact_role: string | null
          country: string
          created_at: string
          cui: string | null
          entity_type: Database["public"]["Enums"]["business_entity_type"]
          goals: string
          id: string
          legal_name: string
          monthly_budget_eur: number | null
          reg_com: string | null
          social_links: string | null
          status: Database["public"]["Enums"]["business_app_status"]
          updated_at: string
          user_id: string | null
          vat_number: string | null
          website: string | null
        }
        Insert: {
          accepts_dpa?: boolean
          accepts_lgbt_charter?: boolean
          accepts_terms?: boolean
          address?: string | null
          admin_notes?: string | null
          brand_name?: string | null
          category?: string | null
          city?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          contact_role?: string | null
          country?: string
          created_at?: string
          cui?: string | null
          entity_type: Database["public"]["Enums"]["business_entity_type"]
          goals: string
          id?: string
          legal_name: string
          monthly_budget_eur?: number | null
          reg_com?: string | null
          social_links?: string | null
          status?: Database["public"]["Enums"]["business_app_status"]
          updated_at?: string
          user_id?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          accepts_dpa?: boolean
          accepts_lgbt_charter?: boolean
          accepts_terms?: boolean
          address?: string | null
          admin_notes?: string | null
          brand_name?: string | null
          category?: string | null
          city?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          contact_role?: string | null
          country?: string
          created_at?: string
          cui?: string | null
          entity_type?: Database["public"]["Enums"]["business_entity_type"]
          goals?: string
          id?: string
          legal_name?: string
          monthly_budget_eur?: number | null
          reg_com?: string | null
          social_links?: string | null
          status?: Database["public"]["Enums"]["business_app_status"]
          updated_at?: string
          user_id?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      consent_log: {
        Row: {
          accepted: boolean
          created_at: string
          id: number
          ip: unknown
          kind: string
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted: boolean
          created_at?: string
          id?: number
          ip?: unknown
          kind: string
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted?: boolean
          created_at?: string
          id?: number
          ip?: unknown
          kind?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      csam_hash_blocklist: {
        Row: {
          added_at: string
          added_by: string | null
          hash: string
          source: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          hash: string
          source?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          hash?: string
          source?: string | null
        }
        Relationships: []
      }
      csam_reports: {
        Row: {
          hash: string | null
          id: string
          match_source: string | null
          ncmec_report_id: string | null
          notes: string | null
          photo_url: string | null
          reported_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          hash?: string | null
          id?: string
          match_source?: string | null
          ncmec_report_id?: string | null
          notes?: string | null
          photo_url?: string | null
          reported_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          hash?: string | null
          id?: string
          match_source?: string | null
          ncmec_report_id?: string | null
          notes?: string | null
          photo_url?: string | null
          reported_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_rewards: {
        Row: {
          claimed_on: string
          created_at: string
          id: string
          reward_amount: number
          reward_kind: string
          streak_day: number
          user_id: string
          xp_awarded: number
        }
        Insert: {
          claimed_on?: string
          created_at?: string
          id?: string
          reward_amount: number
          reward_kind: string
          streak_day: number
          user_id: string
          xp_awarded: number
        }
        Update: {
          claimed_on?: string
          created_at?: string
          id?: string
          reward_amount?: number
          reward_kind?: string
          streak_day?: number
          user_id?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      deletion_requests: {
        Row: {
          id: string
          processed_at: string | null
          reason: string | null
          requested_at: string
          scheduled_for: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      device_fingerprints: {
        Row: {
          fingerprint: string
          first_seen_at: string
          id: string
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          priority: boolean
          status: Database["public"]["Enums"]["rsvp_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          priority?: boolean
          status?: Database["public"]["Enums"]["rsvp_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          priority?: boolean
          status?: Database["public"]["Enums"]["rsvp_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          city: string
          cover_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          geo_bucket_id: string | null
          host_id: string
          id: string
          is_official: boolean
          is_private: boolean
          is_published: boolean
          lat: number | null
          lng: number | null
          max_attendees: number | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          notification_radius_m: number
          rejection_reason: string | null
          starts_at: string
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          city: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          geo_bucket_id?: string | null
          host_id: string
          id?: string
          is_official?: boolean
          is_private?: boolean
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          max_attendees?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          notification_radius_m?: number
          rejection_reason?: string | null
          starts_at: string
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          city?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          geo_bucket_id?: string | null
          host_id?: string
          id?: string
          is_official?: boolean
          is_private?: boolean
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          max_attendees?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          notification_radius_m?: number
          rejection_reason?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      experiment_assignments: {
        Row: {
          assigned_at: string
          experiment_key: string
          id: string
          user_id: string
          variant: string
        }
        Insert: {
          assigned_at?: string
          experiment_key: string
          id?: string
          user_id: string
          variant: string
        }
        Update: {
          assigned_at?: string
          experiment_key?: string
          id?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      experiment_events: {
        Row: {
          created_at: string
          event: string
          experiment_key: string
          id: number
          user_id: string | null
          value: number | null
          variant: string
        }
        Insert: {
          created_at?: string
          event: string
          experiment_key: string
          id?: number
          user_id?: string | null
          value?: number | null
          variant: string
        }
        Update: {
          created_at?: string
          event?: string
          experiment_key?: string
          id?: number
          user_id?: string | null
          value?: number | null
          variant?: string
        }
        Relationships: []
      }
      experiments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          status: string
          updated_at: string
          variants: Json
          weights: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          status?: string
          updated_at?: string
          variants?: Json
          weights?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          status?: string
          updated_at?: string
          variants?: Json
          weights?: Json
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          favorite_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          key: string
          rollout_pct: number
          segment: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key: string
          rollout_pct?: number
          segment?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key?: string
          rollout_pct?: number
          segment?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          page: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
          page?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          page?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          body: string | null
          created_at: string
          group_id: string
          id: string
          media_type: string
          media_url: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          group_id: string
          id?: string
          media_type?: string
          media_url?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          group_id?: string
          id?: string
          media_type?: string
          media_url?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          cover_path: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          member_count: number
          name: string
          owner_id: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name: string
          owner_id: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      illegal_content_reports: {
        Row: {
          category: string
          content_type: string | null
          content_url: string | null
          created_at: string
          description: string
          handled_at: string | null
          handled_by: string | null
          id: string
          legal_basis: string | null
          reporter_email: string | null
          reporter_user_id: string | null
          resolution: string | null
          status: string
        }
        Insert: {
          category: string
          content_type?: string | null
          content_url?: string | null
          created_at?: string
          description: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          legal_basis?: string | null
          reporter_email?: string | null
          reporter_user_id?: string | null
          resolution?: string | null
          status?: string
        }
        Update: {
          category?: string
          content_type?: string | null
          content_url?: string | null
          created_at?: string
          description?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          legal_basis?: string | null
          reporter_email?: string | null
          reporter_user_id?: string | null
          resolution?: string | null
          status?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          audio_duration_ms: number | null
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          media_type: string
          media_url: string | null
          reactions: Json
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
          translated_text: Json | null
          view_once: boolean | null
          viewed_at: string | null
          voice_duration_sec: number | null
          voice_url: string | null
        }
        Insert: {
          audio_duration_ms?: number | null
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          media_type?: string
          media_url?: string | null
          reactions?: Json
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
          translated_text?: Json | null
          view_once?: boolean | null
          viewed_at?: string | null
          voice_duration_sec?: number | null
          voice_url?: string | null
        }
        Update: {
          audio_duration_ms?: number | null
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          media_type?: string
          media_url?: string | null
          reactions?: Json
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
          translated_text?: Json | null
          view_once?: boolean | null
          viewed_at?: string | null
          voice_duration_sec?: number | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      nearby_user_reports: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      offer_claims: {
        Row: {
          claimed_at: string
          id: string
          offer_id: string
          redeemed_at: string | null
          redemption_code: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          offer_id: string
          redeemed_at?: string | null
          redemption_code: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          offer_id?: string
          redeemed_at?: string | null
          redemption_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_claims_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          max_claims_per_user: number
          moderated_at: string | null
          moderated_by: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          rejection_reason: string | null
          terms: string | null
          title: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          max_claims_per_user?: number
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          rejection_reason?: string | null
          terms?: string | null
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          max_claims_per_user?: number
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          rejection_reason?: string | null
          terms?: string | null
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_notification_log: {
        Row: {
          created_at: string
          id: string
          kind: string
          partner_id: string
          recipient_count: number
          target_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          partner_id: string
          recipient_count?: number
          target_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          partner_id?: string
          recipient_count?: number
          target_id?: string | null
        }
        Relationships: []
      }
      photo_hashes: {
        Row: {
          created_at: string
          csam_match: boolean
          id: string
          nudity_score: number | null
          phash: string
          photo_path: string
          quarantined_at: string | null
          scan_status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          csam_match?: boolean
          id?: string
          nudity_score?: number | null
          phash: string
          photo_path: string
          quarantined_at?: string | null
          scan_status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          csam_match?: boolean
          id?: string
          nudity_score?: number | null
          phash?: string
          photo_path?: string
          quarantined_at?: string | null
          scan_status?: string
          user_id?: string
        }
        Relationships: []
      }
      policy_versions: {
        Row: {
          content_url: string | null
          created_by: string | null
          effective_at: string
          id: string
          kind: string
          version: string
        }
        Insert: {
          content_url?: string | null
          created_by?: string | null
          effective_at?: string
          id?: string
          kind: string
          version: string
        }
        Update: {
          content_url?: string | null
          created_by?: string | null
          effective_at?: string
          id?: string
          kind?: string
          version?: string
        }
        Relationships: []
      }
      private_albums: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          photos: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          photos?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          photos?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profile_live_events: {
        Row: {
          updated_at: string
          user_id: string
        }
        Insert: {
          updated_at?: string
          user_id: string
        }
        Update: {
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_views: {
        Row: {
          id: string
          viewed_at: string
          viewed_id: string
          viewer_id: string
        }
        Insert: {
          id?: string
          viewed_at?: string
          viewed_id: string
          viewer_id: string
        }
        Update: {
          id?: string
          viewed_at?: string
          viewed_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accept_nsfw_photos: boolean | null
          age_provider: string | null
          age_status: Database["public"]["Enums"]["age_status"]
          age_verified_at: string | null
          anthem: Json | null
          ask_me_about: string[] | null
          auto_share_album_on_match: boolean
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          birth_date: string | null
          birthdate: string | null
          body_type: string | null
          boost_until: string | null
          boosts_balance: number
          cannabis: string | null
          children: string | null
          company: string | null
          created_at: string
          dealbreakers: string[] | null
          deleted_at: string | null
          diet: string | null
          discreet_mode_enabled: boolean
          discrete_mode: boolean
          display_name: string | null
          drinking: string | null
          drugs: string | null
          education: string | null
          ethnicity: string | null
          expectations: string[] | null
          friends_only_mode: boolean
          gender: string[] | null
          gender_custom: string | null
          health_data_consent_at: string | null
          height_cm: number | null
          hide_age: boolean
          hide_distance: boolean
          hide_online: boolean
          hiv_status_enc: string | null
          hiv_test_date_enc: string | null
          id: string
          ideal_match: string | null
          incognito: boolean
          interests: string[] | null
          job_title: string | null
          languages: string[] | null
          last_check_in_at: string | null
          last_seen: string
          leaderboard_opt_in: boolean
          level: number
          location: unknown
          looking_for: string[] | null
          looking_now_intent: string | null
          looking_now_until: string | null
          marketing_consent_at: string | null
          meet_at: string[] | null
          notification_prefs: Json
          onboarding_completed: boolean
          orientation: string[] | null
          partner_suspended_at: string | null
          partner_suspension_reason: string | null
          pets: string[] | null
          photos: string[] | null
          politics: string | null
          position: string | null
          preferred_language: string | null
          prep_status: string | null
          prev_location: unknown
          prev_location_at: string | null
          privacy_accepted_at: string | null
          privacy_accepted_version: string | null
          profile_completion: number
          profile_slug: string | null
          prompts: Json | null
          pronouns: string[] | null
          pronouns_custom: string | null
          read_receipts_enabled: boolean
          relationship_status: string | null
          religion: string | null
          report_count: number
          risk_score: number
          risk_signals: Json
          risk_updated_at: string | null
          safety_practices: string[] | null
          scenes: string[] | null
          school: string | null
          sleep_schedule: string | null
          smoking: string | null
          sos_contacts: Json
          streak_days: number
          super_taps_balance: number
          suspended_reason: string | null
          suspended_until: string | null
          terms_accepted_at: string | null
          terms_accepted_version: string | null
          top_artists: Json | null
          travel_city: string | null
          travel_location: unknown
          travel_until: string | null
          tribes: string[]
          tz_offset_minutes: number
          updated_at: string
          vaccinations: string[] | null
          verification_reason: string | null
          verification_selfie_path: string | null
          verification_status: string
          verified: boolean
          verified_at: string | null
          video_clip_path: string | null
          voice_bio_duration_sec: number | null
          voice_bio_url: string | null
          voice_prompt_duration_sec: number | null
          voice_prompt_path: string | null
          voice_prompt_question: string | null
          warned_at: string | null
          warned_reason: string | null
          weight_kg: number | null
          workout: string | null
          xp: number
          zodiac: string | null
        }
        Insert: {
          accept_nsfw_photos?: boolean | null
          age_provider?: string | null
          age_status?: Database["public"]["Enums"]["age_status"]
          age_verified_at?: string | null
          anthem?: Json | null
          ask_me_about?: string[] | null
          auto_share_album_on_match?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          birth_date?: string | null
          birthdate?: string | null
          body_type?: string | null
          boost_until?: string | null
          boosts_balance?: number
          cannabis?: string | null
          children?: string | null
          company?: string | null
          created_at?: string
          dealbreakers?: string[] | null
          deleted_at?: string | null
          diet?: string | null
          discreet_mode_enabled?: boolean
          discrete_mode?: boolean
          display_name?: string | null
          drinking?: string | null
          drugs?: string | null
          education?: string | null
          ethnicity?: string | null
          expectations?: string[] | null
          friends_only_mode?: boolean
          gender?: string[] | null
          gender_custom?: string | null
          health_data_consent_at?: string | null
          height_cm?: number | null
          hide_age?: boolean
          hide_distance?: boolean
          hide_online?: boolean
          hiv_status_enc?: string | null
          hiv_test_date_enc?: string | null
          id: string
          ideal_match?: string | null
          incognito?: boolean
          interests?: string[] | null
          job_title?: string | null
          languages?: string[] | null
          last_check_in_at?: string | null
          last_seen?: string
          leaderboard_opt_in?: boolean
          level?: number
          location?: unknown
          looking_for?: string[] | null
          looking_now_intent?: string | null
          looking_now_until?: string | null
          marketing_consent_at?: string | null
          meet_at?: string[] | null
          notification_prefs?: Json
          onboarding_completed?: boolean
          orientation?: string[] | null
          partner_suspended_at?: string | null
          partner_suspension_reason?: string | null
          pets?: string[] | null
          photos?: string[] | null
          politics?: string | null
          position?: string | null
          preferred_language?: string | null
          prep_status?: string | null
          prev_location?: unknown
          prev_location_at?: string | null
          privacy_accepted_at?: string | null
          privacy_accepted_version?: string | null
          profile_completion?: number
          profile_slug?: string | null
          prompts?: Json | null
          pronouns?: string[] | null
          pronouns_custom?: string | null
          read_receipts_enabled?: boolean
          relationship_status?: string | null
          religion?: string | null
          report_count?: number
          risk_score?: number
          risk_signals?: Json
          risk_updated_at?: string | null
          safety_practices?: string[] | null
          scenes?: string[] | null
          school?: string | null
          sleep_schedule?: string | null
          smoking?: string | null
          sos_contacts?: Json
          streak_days?: number
          super_taps_balance?: number
          suspended_reason?: string | null
          suspended_until?: string | null
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          top_artists?: Json | null
          travel_city?: string | null
          travel_location?: unknown
          travel_until?: string | null
          tribes?: string[]
          tz_offset_minutes?: number
          updated_at?: string
          vaccinations?: string[] | null
          verification_reason?: string | null
          verification_selfie_path?: string | null
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          video_clip_path?: string | null
          voice_bio_duration_sec?: number | null
          voice_bio_url?: string | null
          voice_prompt_duration_sec?: number | null
          voice_prompt_path?: string | null
          voice_prompt_question?: string | null
          warned_at?: string | null
          warned_reason?: string | null
          weight_kg?: number | null
          workout?: string | null
          xp?: number
          zodiac?: string | null
        }
        Update: {
          accept_nsfw_photos?: boolean | null
          age_provider?: string | null
          age_status?: Database["public"]["Enums"]["age_status"]
          age_verified_at?: string | null
          anthem?: Json | null
          ask_me_about?: string[] | null
          auto_share_album_on_match?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          birth_date?: string | null
          birthdate?: string | null
          body_type?: string | null
          boost_until?: string | null
          boosts_balance?: number
          cannabis?: string | null
          children?: string | null
          company?: string | null
          created_at?: string
          dealbreakers?: string[] | null
          deleted_at?: string | null
          diet?: string | null
          discreet_mode_enabled?: boolean
          discrete_mode?: boolean
          display_name?: string | null
          drinking?: string | null
          drugs?: string | null
          education?: string | null
          ethnicity?: string | null
          expectations?: string[] | null
          friends_only_mode?: boolean
          gender?: string[] | null
          gender_custom?: string | null
          health_data_consent_at?: string | null
          height_cm?: number | null
          hide_age?: boolean
          hide_distance?: boolean
          hide_online?: boolean
          hiv_status_enc?: string | null
          hiv_test_date_enc?: string | null
          id?: string
          ideal_match?: string | null
          incognito?: boolean
          interests?: string[] | null
          job_title?: string | null
          languages?: string[] | null
          last_check_in_at?: string | null
          last_seen?: string
          leaderboard_opt_in?: boolean
          level?: number
          location?: unknown
          looking_for?: string[] | null
          looking_now_intent?: string | null
          looking_now_until?: string | null
          marketing_consent_at?: string | null
          meet_at?: string[] | null
          notification_prefs?: Json
          onboarding_completed?: boolean
          orientation?: string[] | null
          partner_suspended_at?: string | null
          partner_suspension_reason?: string | null
          pets?: string[] | null
          photos?: string[] | null
          politics?: string | null
          position?: string | null
          preferred_language?: string | null
          prep_status?: string | null
          prev_location?: unknown
          prev_location_at?: string | null
          privacy_accepted_at?: string | null
          privacy_accepted_version?: string | null
          profile_completion?: number
          profile_slug?: string | null
          prompts?: Json | null
          pronouns?: string[] | null
          pronouns_custom?: string | null
          read_receipts_enabled?: boolean
          relationship_status?: string | null
          religion?: string | null
          report_count?: number
          risk_score?: number
          risk_signals?: Json
          risk_updated_at?: string | null
          safety_practices?: string[] | null
          scenes?: string[] | null
          school?: string | null
          sleep_schedule?: string | null
          smoking?: string | null
          sos_contacts?: Json
          streak_days?: number
          super_taps_balance?: number
          suspended_reason?: string | null
          suspended_until?: string | null
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          top_artists?: Json | null
          travel_city?: string | null
          travel_location?: unknown
          travel_until?: string | null
          tribes?: string[]
          tz_offset_minutes?: number
          updated_at?: string
          vaccinations?: string[] | null
          verification_reason?: string | null
          verification_selfie_path?: string | null
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          video_clip_path?: string | null
          voice_bio_duration_sec?: number | null
          voice_bio_url?: string | null
          voice_prompt_duration_sec?: number | null
          voice_prompt_path?: string | null
          voice_prompt_question?: string | null
          warned_at?: string | null
          warned_reason?: string | null
          weight_kg?: number | null
          workout?: string | null
          xp?: number
          zodiac?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string | null
          fcm_token: string
          id: string
          kind: string
          last_seen_at: string
          p256dh: string | null
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint?: string | null
          fcm_token: string
          id?: string
          kind?: string
          last_seen_at?: string
          p256dh?: string | null
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string | null
          fcm_token?: string
          id?: string
          kind?: string
          last_seen_at?: string
          p256dh?: string | null
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quest_templates: {
        Row: {
          bonus_amount: number | null
          bonus_kind: string | null
          description: string
          icon: string
          id: string
          metric: string
          sort_order: number
          target: number
          title: string
          xp_reward: number
        }
        Insert: {
          bonus_amount?: number | null
          bonus_kind?: string | null
          description: string
          icon?: string
          id: string
          metric: string
          sort_order?: number
          target: number
          title: string
          xp_reward: number
        }
        Update: {
          bonus_amount?: number | null
          bonus_kind?: string | null
          description?: string
          icon?: string
          id?: string
          metric?: string
          sort_order?: number
          target?: number
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          action: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          owner_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          owner_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          owner_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      referral_redemptions: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          moderator_notes: string | null
          reason: string
          reported_id: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          moderator_notes?: string | null
          reason: string
          reported_id: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          moderator_notes?: string | null
          reason?: string
          reported_id?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      risk_flags: {
        Row: {
          created_at: string
          details: Json
          id: string
          kind: string
          resolved_at: string | null
          resolved_by: string | null
          severity: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          kind: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      sos_events: {
        Row: {
          city: string | null
          contacts_notified: Json
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          note: string | null
          resolved: boolean
          triggered_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          contacts_notified?: Json
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          resolved?: boolean
          triggered_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          contacts_notified?: Json
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          resolved?: boolean
          triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_path: string
          user_id: string
          view_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_path: string
          user_id: string
          view_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_path?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew: boolean | null
          expires_at: string | null
          id: string
          original_transaction_id: string | null
          platform: string
          product_id: string
          purchase_token: string | null
          raw: Json | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          expires_at?: string | null
          id?: string
          original_transaction_id?: string | null
          platform: string
          product_id: string
          purchase_token?: string | null
          raw?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          expires_at?: string | null
          id?: string
          original_transaction_id?: string | null
          platform?: string
          product_id?: string
          purchase_token?: string | null
          raw?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      swipes: {
        Row: {
          action: string
          created_at: string
          id: string
          match_score: number | null
          swiper_id: string
          target_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          match_score?: number | null
          swiper_id: string
          target_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          match_score?: number | null
          swiper_id?: string
          target_id?: string
        }
        Relationships: []
      }
      taps: {
        Row: {
          created_at: string
          emoji: string
          id: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      user_quests: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          quest_id: string
          user_id: string
          week_start: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          quest_id: string
          user_id: string
          week_start: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          quest_id?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_quests_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quest_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          category: string
          city: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          geo_bucket_id: string
          id: string
          is_official: boolean
          is_published: boolean
          lat: number
          lng: number
          moderated_at: string | null
          moderated_by: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          notification_radius_m: number
          opening_hours: Json | null
          owner_id: string | null
          phone_e164: string | null
          rejection_reason: string | null
          slug: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          geo_bucket_id?: string
          id?: string
          is_official?: boolean
          is_published?: boolean
          lat: number
          lng: number
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          name: string
          notification_radius_m?: number
          opening_hours?: Json | null
          owner_id?: string | null
          phone_e164?: string | null
          rejection_reason?: string | null
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          geo_bucket_id?: string
          id?: string
          is_official?: boolean
          is_published?: boolean
          lat?: number
          lng?: number
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          name?: string
          notification_radius_m?: number
          opening_hours?: Json | null
          owner_id?: string | null
          phone_e164?: string | null
          rejection_reason?: string | null
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      web_vitals: {
        Row: {
          created_at: string
          id: number
          metric: string
          path: string | null
          rating: string | null
          user_agent: string | null
          user_id: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: number
          metric: string
          path?: string | null
          rating?: string | null
          user_agent?: string | null
          user_id?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: number
          metric?: string
          path?: string | null
          rating?: string | null
          user_agent?: string | null
          user_id?: string | null
          value?: number
        }
        Relationships: []
      }
      woofs: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          meta: Json
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          user_id: string
          xp: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      admin_moderation_queue: {
        Row: {
          city: string | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_published: boolean | null
          kind: string | null
          moderation_status:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          owner_id: string | null
          rejection_reason: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      admin_analytics_summary: { Args: never; Returns: Json }
      admin_can_access_sensitive: {
        Args: { _kind: string; _user_id: string }
        Returns: boolean
      }
      admin_get_my_role: { Args: never; Returns: string }
      admin_moderate_item: {
        Args: {
          p_decision: string
          p_id: string
          p_is_official?: boolean
          p_kind: string
          p_notification_radius_m?: number
          p_reason?: string
        }
        Returns: Json
      }
      admin_reinstate_partner: { Args: { p_user_id: string }; Returns: Json }
      admin_risk_queue: {
        Args: { _limit?: number }
        Returns: {
          banned_at: string
          display_name: string
          duplicate_photo_accounts: number
          last_flag_at: string
          open_flags: number
          recent_flag_kinds: string[]
          report_count: number
          risk_score: number
          risk_signals: Json
          suspended_until: string
          user_id: string
          verified: boolean
        }[]
      }
      admin_suspend_partner: {
        Args: { p_reason: string; p_user_id: string }
        Returns: Json
      }
      admin_update_setting: {
        Args: { _actor: string; _key: string; _value: Json }
        Returns: Json
      }
      award_xp: {
        Args: { _kind: string; _meta?: Json; _user_id: string; _xp: number }
        Returns: undefined
      }
      bucket_distance_m: { Args: { d: number }; Returns: number }
      check_rate_limit: {
        Args: { _action: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      claim_daily_reward: { Args: never; Returns: Json }
      claim_offer: {
        Args: { p_offer_id: string }
        Returns: {
          claim_id: string
          redemption_code: string
        }[]
      }
      claim_quest_reward: { Args: { _quest_id: string }; Returns: Json }
      compute_geo_bucket_id: {
        Args: { p_lat: number; p_lng: number }
        Returns: string
      }
      compute_profile_completion: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: number
      }
      consent_kinds: {
        Args: never
        Returns: {
          art9: boolean
          current_version: string
          description: string
          kind: string
          required: boolean
        }[]
      }
      current_week_start: { Args: never; Returns: string }
      detect_admin_anomalies: { Args: never; Returns: number }
      disablelongtransactions: { Args: never; Returns: string }
      discover_profiles:
        | {
            Args: {
              _genders?: string[]
              _limit?: number
              _looking_for?: string[]
              _looking_now_only?: boolean
              _max_age?: number
              _max_km?: number
              _min_age?: number
              _offset?: number
              _sort?: string
              _tab?: string
              _tribes?: string[]
              _viewer: string
            }
            Returns: {
              birthdate: string
              display_name: string
              distance_m: number
              hide_age: boolean
              hide_distance: boolean
              hide_online: boolean
              id: string
              interests: string[]
              last_seen: string
              looking_now_intent: string
              looking_now_until: string
              photos: string[]
              prompts: Json
              pronouns: string[]
              score: number
              tribes: string[]
              verified: boolean
            }[]
          }
        | {
            Args: {
              body_filter?: string[]
              gender_filter?: string[]
              hiv_filter?: string[]
              looking_for_filter?: string[]
              looking_now_only?: boolean
              max_age?: number
              max_distance_km?: number
              max_height?: number
              min_age?: number
              min_height?: number
              online_only?: boolean
              order_mode?: string
              orientation_filter?: string[]
              position_filter?: string[]
              result_limit?: number
              tribes_filter?: string[]
              verified_only?: boolean
              with_photo_only?: boolean
            }
            Returns: {
              bio: string
              birthdate: string
              body_type: string
              boost_until: string
              display_name: string
              distance_m: number
              ethnicity: string
              gender: string[]
              height_cm: number
              id: string
              interests: string[]
              last_seen: string
              looking_for: string[]
              looking_now_intent: string
              looking_now_until: string
              orientation: string[]
              photos: string[]
              position: string
              prompts: Json
              pronouns: string[]
              relationship_status: string
              score: number
              travel_city: string
              travel_until: string
              tribes: string[]
              verified: boolean
              weight_kg: number
            }[]
          }
      distance_bucket_label: { Args: { d: number }; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      ensure_referral_code: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_local_leaderboard: {
        Args: { _radius_km?: number }
        Returns: {
          display_name: string
          level: number
          photo_url: string
          rank: number
          streak_days: number
          user_id: string
          weekly_xp: number
        }[]
      }
      get_my_gamification: { Args: never; Returns: Json }
      get_my_quests: {
        Args: never
        Returns: {
          bonus_amount: number
          bonus_kind: string
          claimed: boolean
          completed: boolean
          description: string
          icon: string
          id: string
          metric: string
          progress: number
          target: number
          title: string
          xp_reward: number
        }[]
      }
      get_or_create_conversation: { Args: { _other: string }; Returns: string }
      get_public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          bio: string
          birthdate: string
          body_type: string
          boost_until: string
          display_name: string
          gender: string
          height_cm: number
          hide_age: boolean
          hide_distance: boolean
          hide_online: boolean
          id: string
          incognito: boolean
          interests: string[]
          last_seen: string
          looking_now_until: string
          photos: string[]
          position: string
          profile_slug: string
          pronouns: string
          travel_city: string
          travel_until: string
          tribes: string[]
          verified: boolean
        }[]
      }
      get_user_health: {
        Args: { _key: string; _user_id: string }
        Returns: {
          hiv_status: string
          hiv_test_date: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_active_consent: {
        Args: { _kind: string; _user_id: string }
        Returns: boolean
      }
      has_active_health_consent: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_active_subscription: { Args: { _user: string }; Returns: boolean }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      health_gated_columns: { Args: never; Returns: string[] }
      increment_quest_progress: {
        Args: { _delta?: number; _metric: string; _user_id: string }
        Returns: undefined
      }
      is_admin_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_fingerprint_banned: { Args: { _fp: string }; Returns: boolean }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_inactive_for_deletion: { Args: never; Returns: number }
      mark_message_viewed: { Args: { _msg_id: string }; Returns: undefined }
      moderator_ban_user: {
        Args: { _reason: string; _target: string }
        Returns: undefined
      }
      moderator_suspend_user: {
        Args: { _hours: number; _reason: string; _target: string }
        Returns: undefined
      }
      moderator_verify_user: { Args: { _target: string }; Returns: undefined }
      moderator_warn_user: {
        Args: { _reason: string; _target: string }
        Returns: undefined
      }
      nearby_points: {
        Args: { p_bucket_id: string; p_kinds?: string[] }
        Returns: {
          category: string
          city: string
          cover_url: string
          description: string
          ends_at: string
          id: string
          kind: string
          lat: number
          lng: number
          name: string
          starts_at: string
          venue_id: string
        }[]
      }
      neighbour_buckets: { Args: { p_bucket_id: string }; Returns: string[] }
      notify_user: {
        Args: {
          _actor_id: string
          _body: string
          _entity_id: string
          _link: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: undefined
      }
      offer_stats: {
        Args: { p_offer_id: string }
        Returns: {
          claim_count: number
          redeemed_count: number
        }[]
      }
      partner_can_send_notification: {
        Args: { p_partner_id: string }
        Returns: boolean
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      purge_scheduled_deletions: { Args: never; Returns: number }
      recompute_risk_score: { Args: { _uid: string }; Returns: number }
      record_age_verification: {
        Args: {
          p_didit_session?: string
          p_estimated_age?: number
          p_result: string
          p_status_raw?: string
          p_user_id: string
        }
        Returns: undefined
      }
      record_consent: {
        Args: { _accepted?: boolean; _kind: string; _version?: string }
        Returns: undefined
      }
      record_photo_hash: {
        Args: { _path: string; _phash: string }
        Returns: undefined
      }
      redeem_referral: { Args: { _code: string }; Returns: Json }
      register_device_fingerprint: {
        Args: { _fp: string; _ua: string }
        Returns: boolean
      }
      set_looking_now: {
        Args: { _hours: number; _intent?: string }
        Returns: undefined
      }
      set_user_health: {
        Args: { _date: string; _key: string; _status: string; _user_id: string }
        Returns: undefined
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      start_age_verification: { Args: never; Returns: undefined }
      toggle_message_reaction: {
        Args: { _emoji: string; _msg_id: string }
        Returns: Json
      }
      touch_last_seen: { Args: never; Returns: undefined }
      unlockrows: { Args: { "": string }; Returns: number }
      unsend_message: { Args: { _message_id: string }; Returns: undefined }
      update_my_location: {
        Args: { lat: number; lng: number }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      withdraw_health_consent: {
        Args: { _version?: string }
        Returns: undefined
      }
    }
    Enums: {
      age_status: "unverified" | "pending" | "verified" | "failed" | "expired"
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "business"
        | "super_admin"
        | "support"
        | "auditor"
        | "read_only"
      business_app_status: "pending" | "reviewing" | "approved" | "rejected"
      business_entity_type:
        | "srl"
        | "pfa"
        | "ii"
        | "sa"
        | "ong"
        | "asociatie"
        | "fundatie"
        | "brand"
        | "organizator_eveniment"
        | "altul"
      event_type: "party" | "bar" | "pride" | "private" | "meetup" | "other"
      moderation_status:
        | "pending"
        | "approved"
        | "rejected"
        | "changes_requested"
      notification_type:
        | "match"
        | "message"
        | "profile_view"
        | "album_request"
        | "album_granted"
        | "event_rsvp"
        | "event_reminder"
        | "tap"
      rsvp_status: "going" | "interested"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      age_status: ["unverified", "pending", "verified", "failed", "expired"],
      app_role: [
        "admin",
        "moderator",
        "user",
        "business",
        "super_admin",
        "support",
        "auditor",
        "read_only",
      ],
      business_app_status: ["pending", "reviewing", "approved", "rejected"],
      business_entity_type: [
        "srl",
        "pfa",
        "ii",
        "sa",
        "ong",
        "asociatie",
        "fundatie",
        "brand",
        "organizator_eveniment",
        "altul",
      ],
      event_type: ["party", "bar", "pride", "private", "meetup", "other"],
      moderation_status: [
        "pending",
        "approved",
        "rejected",
        "changes_requested",
      ],
      notification_type: [
        "match",
        "message",
        "profile_view",
        "album_request",
        "album_granted",
        "event_rsvp",
        "event_reminder",
        "tap",
      ],
      rsvp_status: ["going", "interested"],
    },
  },
} as const
