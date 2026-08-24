/**
 * Registru de versiuni pentru documentele legale publice.
 *
 * Sursă unică pentru:
 *  - istoricul modificărilor listei de subprocesatori (/legal/subprocessors)
 *  - versiunile PDF descărcabile ale DPA (/legal/dpa)
 *
 * La o actualizare: adaugă o intrare NOUĂ la începutul array-ului (cea mai
 * recentă prima) și, pentru DPA, generează PDF-ul cu
 * `python3 scripts/build-dpa-pdf.py` după ce actualizezi `docs/legal/dpa-source.md`.
 */

export type LegalChange = {
  /** ISO date, ex. "2026-08-25" */
  date: string;
  /** Versiunea documentului la acea dată */
  version: string;
  /** Ce s-a schimbat, pe scurt, în limbaj clar */
  changes: string[];
};

/** Istoricul modificărilor listei de subprocesatori. Cea mai recentă prima. */
export const SUBPROCESSOR_CHANGELOG: LegalChange[] = [
  {
    date: "2026-08-25",
    version: "2.3",
    changes: [
      "Adăugat istoric public al modificărilor și dată explicită a ultimei actualizări.",
      "Adăugată secțiunea dedicată transferurilor extra-UE (SCC / EU-US DPF) la /legal/transfers.",
    ],
  },
  {
    date: "2026-08-20",
    version: "2.2",
    changes: [
      "Google Sign-In (OAuth) marcat DEZACTIVAT — fluxul de autentificare cu Google a fost eliminat din aplicație; nu mai transmitem date către acest serviciu.",
      "Adăugate activitățile A18 (program Ambasador / antifraudă) și A19 (livrare comenzi merch) în registrul Art. 30.",
    ],
  },
  {
    date: "2026-07-05",
    version: "2.1",
    changes: [
      "Didit ID Verification actualizat: trecere de la verificare cu document la estimarea vârstei din selfie, cu ștergere imediată a imaginii de către procesator.",
      "OpenStreetMap Foundation adăugat pentru tile-urile de hartă din „Aproape de tine”.",
    ],
  },
  {
    date: "2026-05-12",
    version: "2.0",
    changes: [
      "RevenueCat și Google Play Billing adăugate pentru orchestrarea abonamentelor.",
      "Cloudflare listat explicit ca procesator pentru edge runtime și CDN.",
    ],
  },
  {
    date: "2026-02-01",
    version: "1.0",
    changes: ["Prima publicare a listei de subprocesatori (Supabase, push services, AI Gateway, ANAF)."],
  },
];

export type DpaVersion = {
  version: string;
  /** ISO date */
  date: string;
  /** Cale publică către PDF (servit din /public) */
  file: string;
  /** Rezumat al modificărilor față de versiunea anterioară */
  notes: string;
  /** Versiunea curentă în vigoare */
  current: boolean;
};

/**
 * Versiunile PDF ale DPA. Pentru a înlocui documentul:
 *  1. editează `docs/legal/dpa-source.md`
 *  2. rulează `python3 scripts/build-dpa-pdf.py --version 1.1`
 *  3. adaugă intrarea nouă aici cu `current: true` și pune `current: false` pe cea veche.
 */
export const DPA_VERSIONS: DpaVersion[] = [
  {
    version: "1.0",
    date: "2026-08-25",
    file: "/legal/dpa-v1.0.pdf",
    notes: "Prima versiune publicată a Acordului de prelucrare a datelor (Art. 28 GDPR).",
    current: true,
  },
];

export const CURRENT_DPA = DPA_VERSIONS.find((v) => v.current) ?? DPA_VERSIONS[0];

export function formatLegalDate(iso: string, lang: "ro" | "en" = "ro"): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Ultima actualizare a listei de subprocesatori (derivată din changelog). */
export const SUBPROCESSORS_LAST_UPDATED = SUBPROCESSOR_CHANGELOG[0]?.date ?? "2026-08-25";
export const SUBPROCESSORS_VERSION = SUBPROCESSOR_CHANGELOG[0]?.version ?? "1.0";
