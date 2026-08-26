/**
 * Logică pură pentru "starea contului nou": confirmare email → onboarding →
 * verificare 18+ (Didit). Fără efecte secundare, ca să poată fi testată direct.
 */

export type AccountFlowStepId = "email" | "profile" | "didit";
export type AccountFlowStepState = "done" | "current" | "todo" | "blocked";

export type AccountFlowInput = {
  emailConfirmed: boolean;
  profileComplete: boolean;
  /** age_status din profiles */
  ageStatus: "unverified" | "pending" | "verified" | "failed" | "expired" | null;
  /** true dacă există o sesiune Didit deschisă */
  hasDiditSession?: boolean;
};

export type AccountFlowStep = {
  id: AccountFlowStepId;
  title: string;
  description: string;
  state: AccountFlowStepState;
  /** Ce trebuie să facă utilizatorul acum, în limbaj clar. */
  nextAction: string | null;
};

export type AccountFlowSummary = {
  steps: AccountFlowStep[];
  currentStep: AccountFlowStepId | null;
  /** null când totul e complet */
  headline: string;
  done: boolean;
};

export function computeAccountFlow(input: AccountFlowInput): AccountFlowSummary {
  const { emailConfirmed, profileComplete, ageStatus, hasDiditSession = false } = input;

  const diditDone = ageStatus === "verified";
  const diditFailed = ageStatus === "failed" || ageStatus === "expired";
  const diditPending = ageStatus === "pending" || (ageStatus === "unverified" && hasDiditSession);

  const emailStep: AccountFlowStep = {
    id: "email",
    title: "Confirmă emailul",
    description: emailConfirmed
      ? "Adresa ta de email este confirmată."
      : "Ți-am trimis un link de activare. Deschide-l din aplicația de email.",
    state: emailConfirmed ? "done" : "current",
    nextAction: emailConfirmed
      ? null
      : "Deschide linkul din email. Dacă nu a ajuns în 2 minute, verifică Spam/Promoții și apasă „Retrimite email de confirmare”.",
  };

  const profileStep: AccountFlowStep = {
    id: "profile",
    title: "Completează profilul",
    description: profileComplete
      ? "Profilul tău de bază este completat."
      : "Ai nevoie de nume, dată de naștere și cel puțin o poză.",
    state: profileComplete ? "done" : emailConfirmed ? "current" : "blocked",
    nextAction: profileComplete
      ? null
      : emailConfirmed
        ? "Continuă onboarding-ul și salvează profilul."
        : "Se deblochează după confirmarea emailului.",
  };

  const diditStep: AccountFlowStep = {
    id: "didit",
    title: "Verificare 18+",
    description: diditDone
      ? "Vârsta ta a fost confirmată."
      : diditFailed
        ? ageStatus === "expired"
          ? "Sesiunea de verificare a expirat înainte de finalizare."
          : "Didit nu a putut confirma vârsta din selfie."
        : diditPending
          ? "Didit procesează selfie-ul tău. De obicei durează sub 60 de secunde."
          : "Nu ai pornit încă verificarea vârstei.",
    state: diditDone
      ? "done"
      : !emailConfirmed || !profileComplete
        ? "blocked"
        : "current",
    nextAction: diditDone
      ? null
      : !emailConfirmed
        ? "Se deblochează după confirmarea emailului."
        : !profileComplete
          ? "Se deblochează după completarea profilului."
          : diditFailed
            ? "Reia verificarea: lumină bună pe față, fără ochelari de soare sau șapcă."
            : diditPending
              ? "Lasă pagina deschisă — actualizăm automat. Dacă durează peste 5 minute, apasă „Reîmprospătează”."
              : "Pornește verificarea și acordă consimțământul pentru estimarea vârstei.",
  };

  const steps = [emailStep, profileStep, diditStep];
  const current = steps.find((s) => s.state === "current") ?? null;
  const done = steps.every((s) => s.state === "done");

  return {
    steps,
    currentStep: current?.id ?? null,
    headline: done
      ? "Contul tău este complet activat."
      : current
        ? `Pas curent: ${current.title}`
        : "Așteptăm deblocarea pasului următor.",
    done,
  };
}
