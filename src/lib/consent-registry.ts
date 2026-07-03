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
  | "age_verification"
  | "internal_verification"
  | "health_data"
  | "ai_features"
  | "push_notifications"
  | "background_location"
  | "marketing"
  | "partner_announcements";

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
    currentVersion: "2026-07-03",
    required: true,
    art9: false,
    label: "Termeni și condiții",
    description:
      "Acord cu termenii de utilizare Ventuza, inclusiv confirmarea că am cel puțin 18 ani.",
    gates: ["account_creation"],
  },
  privacy: {
    kind: "privacy",
    currentVersion: "2026-07-03",
    required: true,
    art9: false,
    label: "Politica de confidențialitate",
    description: "Acord cu modul în care prelucrăm datele tale (vezi /legal/privacy).",
    gates: ["account_creation"],
  },
  age_verification: {
    kind: "age_verification",
    currentVersion: "2026-07-03",
    required: true,
    art9: true,
    label: "Verificare vârstă (proces intern)",
    description:
      "Pentru a confirma că ai 18+, prelucrăm intern selfie-uri liveness (fără terți) revizuite manual de moderator. Imaginile sunt șterse automat după 30 de zile. Fără acest consimțământ, nu putem porni verificarea.",
    gates: ["verification_submit_request"],
  },
  internal_verification: {
    kind: "internal_verification",
    currentVersion: "2026-07-03",
    required: true,
    art9: true,
    label: "Verificare identitate internă",
    description:
      "Prelucrăm intern selfie-urile tale (liveness cu instrucțiuni random) pentru a acorda badge-ul verificat. Imaginile nu părăsesc infrastructura noastră, nu sunt vândute, nu sunt folosite pentru antrenare AI, nu sunt folosite pentru publicitate. Sunt vizibile doar moderatorilor de verificare pentru maxim 30 de zile, apoi șterse automat. Poți retrage consimțământul oricând (badge-ul se retrage și cererile în curs se șterg).",
    gates: ["verification_submit_request"],
  },
  health_data: {
    kind: "health_data",
    currentVersion: "2026-06-26",
    required: false,
    art9: true,
    label: "Date de sănătate (HIV status)",
    description:
      "Alegi opțional să declari status HIV / dată test. Datele sunt cifrate la coloană și accesibile doar ție și partenerilor cu care alegi să le împărtășești. Poți retrage oricând (câmpurile se șterg automat).",
    gates: ["set_user_health"],
  },

  ai_features: {
    kind: "ai_features",
    currentVersion: "2026-06-26",
    required: false,
    art9: false,
    label: "Funcții AI (asistent bio, openere, traduceri)",
    description:
      "Atunci când folosești AI (sugestii bio, openere chat, photo coach, traducere, match score), textul / pozele tale sunt trimise către Lovable AI Gateway (procesator extern, EU/SUA). Fără acest consimțământ, butoanele AI sunt dezactivate.",
    gates: [
      "generateBio",
      "generateOpener",
      "translateText",
      "photoCoach",
      "matchScore",
      "verifySelfie",
    ],
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
  background_location: {
    kind: "background_location",
    currentVersion: "2026-06-26",
    required: false,
    art9: false,
    label: "Locație în fundal (geofencing)",
    description:
      "Pentru a te anunța când treci pe lângă un eveniment sau local aprobat — chiar și cu aplicația închisă — avem nevoie de permisiunea pentru locație în fundal. Calculul se face pe dispozitiv; coordonatele tale exacte NU pleacă la server și NU stocăm traseul tău. Poți retrage oricând din Setări.",
    gates: ["proximity_background_geofence"],
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
  partner_announcements: {
    kind: "partner_announcements",
    currentVersion: "2026-07-03",
    required: false,
    art9: false,
    label: "Anunțuri de la parteneri Premium",
    description:
      "Primești ocazional notificări de la parteneri Premium aprobați (evenimente, oferte, promoții) — filtrate după oraș, distanță sau participare la evenimentele lor. Opt-in explicit (implicit oprit). Se aplică plafoane săptămânale per partener și un cooldown de 24h per user. Poți retrage oricând.",
    gates: ["partner_send_broadcast"],
  },
};

export const ALL_CONSENT_KINDS: ConsentKind[] = Object.keys(CONSENT_REGISTRY) as ConsentKind[];

export function getConsentMeta(kind: ConsentKind): ConsentMeta {
  return CONSENT_REGISTRY[kind];
}
