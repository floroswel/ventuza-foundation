export type DiditReason =
  | "verified"
  | "no_session"
  | "awaiting_user"
  | "no_webhook_event"
  | "in_review"
  | "pending_provider"
  | "failed"
  | "expired"
  | "declined"
  | "unknown";

export type DiditStatusResponse = {
  profile: {
    age_status: string | null;
    age_verified_at: string | null;
    age_provider: string | null;
  } | null;
  lastSession: {
    session_id: string;
    status: string;
    result: string | null;
    estimated_age: number | null;
    session_url: string | null;
    created_at: string;
    resolved_at: string | null;
    webhook_received: boolean;
  } | null;
  reasonCode: DiditReason;
  lastUpdatedAt: string | null;
};

export type DiditSyncResponse =
  | { ok: true; session_id: string; status: string; result: string }
  | { ok: false; reason: "no_session" | "no_decision"; error?: string | null };
