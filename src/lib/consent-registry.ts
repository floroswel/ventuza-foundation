/**
 * CONSENT REGISTRY — single source of truth pentru tipurile de consimțământ.
 *
 * Mirror al funcției SQL `public.consent_kinds()` (vezi migrarea de consent
 * registry + AGENTS.md "REGULĂ — CONSIMȚĂMINTE (permanentă)").
 *
 * - DB-ul este sursa autoritativă pentru enforcement (RPC `has_active_consent`,
 *   `record_consent`, triggere). Acest fișier oglindeste lista pentru UI și
 *   pentru gate-urile din server-fns.
 * - Versiunile trebuie să rămână în sync cu funcția SQL.
 * - Orice kind nou se adaugă AICI și în `public.consent_kinds()` în aceeași PR.
 */

export type ConsentKind =
  | "terms"
  | "privacy"
  | "health_data"
  | "age_verification"
  | "ai_features"
  | "push_notifications"
  | "background_location"
  | "marketing";

export interface ConsentMeta {
  kind: ConsentKind;
  /** Versiunea curentă (trebuie să corespundă cu cea din SQL). */
  currentVersion: string;
  /** Obligatoriu pentru folosirea serviciului (terms/privacy). */
  required: boolean;
  /** Date din categorii speciale GDPR Art. 9. */
  art9: boolean;
  /** Etichetă scurtă pentru UI. */
  label: string;
  /** Descriere completă cu transparența GDPR (UI + Records of Processing). */
  description: string;
  /**
   * Acțiuni / câmpuri gated de acest consimțământ — referință pentru dezvoltator.
   * (Enforcement-ul real e în DB + în server-fn-uri, nu aici.)
   */
  gates: string[];
  /** Procesator extern asociat (din src/routes/legal.subprocessors.tsx). */
  processor?: string;
}

export const CONSENT_REGISTRY: Record<ConsentKind, ConsentMeta> = {
  terms: {
    kind: "terms",
    currentVersion: "2026-06-22",
    required: true,
    art9: false,
    label: "Termeni și condiții",
    description: "Acord cu termenii de utilizare ai Ventuza.",
    gates: ["account_creation"],
  },
  privacy: {
    kind: "privacy",
    currentVersion: "2026-06-22",
    required: true,
    art9: false,
    label: "Politica de confidențialitate",
    description: "Acord cu modul în care prelucrăm datele tale (vezi /legal/privacy).",
    gates: ["account_creation"],
  },
  health_data: {
    kind: "health_data",
    currentVersion: "2026-06-22",
    required: false,
    art9: true,
    label: "Date de sănătate (HIV)",
    description:
      "Stocăm statusul HIV și data testului în profilul tău. Vizibil doar conform setărilor tale. Le poți șterge oricând retrăgând consimțământul.",
    gates: ["profiles.hiv_status", "profiles.hiv_test_date"],
  },
  age_verification: {
    kind: "age_verification",
    currentVersion: "2026-06-26",
    required: false,
    art9: true,
    label: "Verificare vârstă cu imagine biometrică",
    description:
      "Pentru a confirma că ai 18+, trimitem un selfie către Didit (operator extern, UE). Imaginea este prelucrată pentru estimarea vârstei și apoi ștearsă conform politicii Didit (max 30 zile). Fără acest consimțământ, nu putem porni verificarea.",
    gates: ["startAgeVerification (Didit)"],
    processor: "P6 — Didit (verificare vârstă)",
  },
  ai_features: {
    kind: "ai_features",
    currentVersion: "2026-06-26",
    required: false,
    art9: false,
    label: "Funcții AI (asistent bio, openere, traduceri)",
    description:
      "Atunci când folosești AI (sugestii bio, openere chat, photo coach, traducere, match score), textul / pozele tale sunt trimise către Lovable AI Gateway (procesator extern, EU/SUA). Fără acest consimțământ, butoanele AI sunt dezactivate.",
    gates: ["generateBio", "generateOpener", "translateText", "photoCoach", "matchScore", "verifySelfie"],
    processor: "P7 — Lovable AI Gateway",
  },
  push_notifications: {
    kind: "push_notifications",
    currentVersion: "2026-06-26",
    required: false,
    art9: false,
    label: "Notificări push",
    description:
      "Trimitem notificări push prin browser/OS (FCM/APNs) când primești mesaje, match-uri sau evenimente relevante. Activarea și dezactivarea sunt înregistrate.",
    gates: ["push_subscriptions"],
    processor: "P4 — Push services (FCM/APNs)",
  },
  marketing: {
    kind: "marketing",
    currentVersion: "2026-06-22",
    required: false,
    art9: false,
    label: "Comunicări de marketing",
    description: "Newsletter și oferte (opțional). Te poți dezabona oricând.",
    gates: ["email_marketing"],
  },
};

export const ALL_CONSENT_KINDS: ConsentKind[] = Object.keys(CONSENT_REGISTRY) as ConsentKind[];

export function getConsentMeta(kind: ConsentKind): ConsentMeta {
  return CONSENT_REGISTRY[kind];
}
