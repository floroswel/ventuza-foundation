import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiComplete } from "./ai.server";

// ---------- Verify selfie ----------
// Compare a freshly uploaded selfie against the user's main profile photo.
// If AI determines they are the same person → mark verified.
const VerifyInput = z.object({
  selfieUrl: z.string().url(),
  mainPhotoUrl: z.string().url(),
});

export const verifySelfie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VerifyInput.parse(d))
  .handler(async ({ data, context }) => {
    const sys =
      'Ești un sistem de verificare identitate pentru o app de dating. Primești 2 poze: (1) selfie live cu un gest cerut (ex: degetul mare ridicat), (2) poza principală de profil. Răspunzi DOAR JSON valid: {"same_person": <true|false>, "gesture_visible": <true|false>, "real_selfie": <true|false>, "reason": "<scurt, în română>"}. real_selfie=false dacă pare poză copiată de pe internet sau editată. Fii strict — în caz de dubiu, false.';
    const raw = await aiComplete({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: [
            { type: "text", text: "Poza 1: SELFIE LIVE (cu degetul mare ridicat). Poza 2: POZA DE PROFIL." },
            { type: "image_url", image_url: { url: data.selfieUrl } },
            { type: "image_url", image_url: { url: data.mainPhotoUrl } },
          ],
        },
      ],
      temperature: 0.1,
      maxTokens: 200,
      json: true,
    });
    let parsed: { same_person: boolean; gesture_visible: boolean; real_selfie: boolean; reason: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI a returnat răspuns invalid. Încearcă din nou.");
    }

    const ok = parsed.same_person && parsed.gesture_visible && parsed.real_selfie;
    const { error } = await context.supabase
      .from("profiles")
      .update({
        verification_status: ok ? "verified" : "rejected",
        verification_reason: parsed.reason ?? null,
        verified_at: ok ? new Date().toISOString() : null,
        verified: ok,
      })
      .eq("id", context.userId);
    if (error) throw error;

    return { verified: ok, reason: parsed.reason };
  });

// ---------- Moderate photo on upload ----------
const ModerateInput = z.object({ photoUrl: z.string().url() });

export const moderatePhoto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ModerateInput.parse(d))
  .handler(async ({ data }) => {
    const sys =
      'Ești moderator STRICT pentru poze PUBLICE (profil & stories) într-o app gay de dating. RESPINGI orice: nuditate (genitalii, fese goale, sâni/sfârcuri expuși), lenjerie intimă care arată conturul genitalelor, erecție vizibilă chiar prin haine, acte sexuale, minori, violență, screenshot-uri, logo/reclamă comercială. ACCEPȚI: torso fără tricou (gym/plajă/piscină) câtă vreme nu e provocator sexual, selfie-uri normale, poze cu prieteni, peisaje. Conținut nud / sexual e permis DOAR în album privat, nu aici. În dubiu → respinge. Răspunzi DOAR JSON: {"allowed": <true|false>, "reason": "<scurt, română, fără termeni vulgari>"}.';
    const raw = await aiComplete({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: [
            { type: "text", text: "Evaluează poza:" },
            { type: "image_url", image_url: { url: data.photoUrl } },
          ],
        },
      ],
      temperature: 0.1,
      maxTokens: 120,
      json: true,
    });
    try {
      const j = JSON.parse(raw) as { allowed: boolean; reason: string };
      return { allowed: !!j.allowed, reason: String(j.reason ?? "") };
    } catch {
      return { allowed: true, reason: "" };
    }
  });
