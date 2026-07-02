import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiComplete } from "./ai.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Toate funcțiile AI sunt gated de consimțământul `ai_features` în consent_log.
 * Vezi AGENTS.md "REGULĂ — CONSIMȚĂMINTE (permanentă)" și src/lib/consent-registry.ts.
 */
async function requireAiConsent(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_active_consent", { _user_id: userId, _kind: "ai_features" });
  if (error) throw new Error("Nu am putut verifica consimțământul AI.");
  if (data !== true) {
    throw new Error("ai_consent_required: activează „Funcții AI” din Setări → Confidențialitate pentru a folosi această funcție.");
  }
}

/**
 * Fire-and-forget: rulează regulile Policy Engine din categoria `ai_gateway`
 * și scrie în `policy_evaluations`. Nu blochează request-ul dacă eșuează.
 * Vezi AGENTS.md "Policy Engine" — regulile în `shadow` doar loghează,
 * cele în `enforcing` returnează `enforce` (aplicat de caller dacă vrea).
 */
async function evalAiPolicy(
  supabase: SupabaseClient<Database>,
  userId: string,
  op: string,
  input: Record<string, unknown>,
) {
  try {
    await supabase.rpc("policy_evaluate" as never, {
      _category: "ai_gateway",
      _subject_kind: "user",
      _subject_id: userId,
      _input: { op, ...input } as never,
    } as never);
  } catch { /* nu blocăm AI-ul dacă evaluatorul eșuează */ }
}


// ---------- Bio writer ----------
const BioInput = z.object({
  name: z.string().optional(),
  age: z.number().optional(),
  interests: z.array(z.string()).optional(),
  tribes: z.array(z.string()).optional(),
  lookingFor: z.array(z.string()).optional(),
  vibe: z.enum(["flirty", "chill", "witty", "sincere", "mysterious"]).default("witty"),
});

export const generateBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BioInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAiConsent(context.supabase, context.userId);
    void evalAiPolicy(context.supabase, context.userId, "generateBio", {
      input_len: JSON.stringify(data).length,
      interests_count: data.interests?.length ?? 0,
      vibe: data.vibe,
    });
    const sys =
      "Ești un copywriter pentru o app gay de dating (Ventuza). Scrii bio-uri scurte, autentice, fără clișee, fără emoji excesive, fără hashtag-uri. Max 280 caractere. Răspunzi DOAR cu bio-ul, fără ghilimele.";
    const facts = [
      data.name && `Nume: ${data.name}`,
      data.age && `Vârstă: ${data.age}`,
      data.interests?.length && `Interese: ${data.interests.join(", ")}`,
      data.tribes?.length && `Triburi: ${data.tribes.join(", ")}`,
      data.lookingFor?.length && `Caută: ${data.lookingFor.join(", ")}`,
      `Vibe: ${data.vibe}`,
    ].filter(Boolean).join("\n");
    const text = await aiComplete({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Scrie un bio ${data.vibe} pe baza:\n${facts}` },
      ],
      temperature: 0.9,
      maxTokens: 200,
    });
    return { bio: text };
  });


// ---------- Wingman / opener ----------
const OpenerInput = z.object({
  myName: z.string().optional(),
  theirName: z.string().optional(),
  theirBio: z.string().optional(),
  theirInterests: z.array(z.string()).optional(),
  style: z.enum(["playful", "smart", "direct", "flirty"]).default("playful"),
});

export const generateOpener = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OpenerInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAiConsent(context.supabase, context.userId);
    void evalAiPolicy(context.supabase, context.userId, "generateOpener", {
      input_len: (data.theirBio ?? "").length,
      interests_count: data.theirInterests?.length ?? 0,
      style: data.style,
    });
    const sys =
      'Ești Wingman AI într-o app gay de dating. Generezi 3 mesaje de deschidere SCURTE (max 140 caractere fiecare), personalizate pe bio-ul/interesele celuilalt. Nu folosi "Salut" generic. Fără emoji excesiv. Răspunzi DOAR cu cele 3 opțiuni numerotate 1., 2., 3., fără explicații.';
    const facts = [
      data.theirName && `El: ${data.theirName}`,
      data.theirBio && `Bio: ${data.theirBio}`,
      data.theirInterests?.length && `Interese: ${data.theirInterests.join(", ")}`,
      `Stil: ${data.style}`,
    ].filter(Boolean).join("\n");
    const text = await aiComplete({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Generează 3 openere ${data.style}:\n${facts}` },
      ],
      temperature: 0.95,
      maxTokens: 300,
    });
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    return { openers: lines };
  });

// ---------- Translate ----------
const TranslateInput = z.object({
  text: z.string().min(1).max(2000),
  targetLang: z.string().default("ro"),
});

export const translateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TranslateInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAiConsent(context.supabase, context.userId);
    void evalAiPolicy(context.supabase, context.userId, "translateText", {
      input_len: data.text.length,
      target_lang: data.targetLang,
    });
    const text = await aiComplete({
      messages: [
        { role: "system", content: `Traduci mesaje de chat în ${data.targetLang}. Răspunzi DOAR cu traducerea, păstrând tonul.` },
        { role: "user", content: data.text },
      ],
      temperature: 0.3,
      maxTokens: 500,
    });
    return { translation: text };
  });

// ---------- Photo Coach ----------
const PhotoCoachInput = z.object({
  photoUrls: z.array(z.string().url()).min(1).max(9),
});

export const photoCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PhotoCoachInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAiConsent(context.supabase, context.userId);
    void evalAiPolicy(context.supabase, context.userId, "photoCoach", {
      photos_count: data.photoUrls.length,
    });
    const sys =
      "Ești un photo coach pentru o app gay de dating. Analizezi pozele și dai feedback concret, prietenos, în română. Pentru fiecare poză: 1 punct forte + 1 sugestie. La final: o recomandare globală (ce poză ar fi cea principală, ce să adauge/scoată). Ton: încurajator, direct, fără clișee. Max 600 caractere total. Fără markdown.";
    const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
      { type: "text", text: `Analizează cele ${data.photoUrls.length} poze de profil:` },
      ...data.photoUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ];
    const text = await aiComplete({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content },
      ],
      temperature: 0.7,
      maxTokens: 600,
    });
    return { feedback: text };
  });

// ---------- Match Score ----------
const ProfileSummary = z.object({
  name: z.string().optional(),
  age: z.number().optional(),
  bio: z.string().optional(),
  interests: z.array(z.string()).optional(),
  tribes: z.array(z.string()).optional(),
  lookingFor: z.array(z.string()).optional(),
});
const MatchInput = z.object({ me: ProfileSummary, them: ProfileSummary });

export const matchScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MatchInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAiConsent(context.supabase, context.userId);
    void evalAiPolicy(context.supabase, context.userId, "matchScore", {
      me_bio_len: (data.me.bio ?? "").length,
      them_bio_len: (data.them.bio ?? "").length,
    });
    const sys =
      'Evaluezi compatibilitatea între doi useri pe app gay de dating. Răspunzi DOAR JSON valid: {"score": <0-100>, "reason": "<o frază scurtă în română, max 120 caractere, care explică DE CE>"}. Bazează-te pe interese comune, ce caută fiecare, triburi, vibe-ul bio-ului. Fii realist — nu da 90+ fără motive solide.';
    const fmt = (p: z.infer<typeof ProfileSummary>) =>
      [
        p.name && `Nume: ${p.name}`,
        p.age && `Vârstă: ${p.age}`,
        p.bio && `Bio: ${p.bio}`,
        p.interests?.length && `Interese: ${p.interests.join(", ")}`,
        p.tribes?.length && `Triburi: ${p.tribes.join(", ")}`,
        p.lookingFor?.length && `Caută: ${p.lookingFor.join(", ")}`,
      ].filter(Boolean).join("\n");
    const text = await aiComplete({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `EU:\n${fmt(data.me)}\n\nEL:\n${fmt(data.them)}` },
      ],
      temperature: 0.4,
      maxTokens: 200,
      json: true,
    });
    try {
      const parsed = JSON.parse(text) as { score: number; reason: string };
      const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
      return { score, reason: String(parsed.reason ?? "").slice(0, 140) };
    } catch {
      return { score: 50, reason: "Compatibilitate medie." };
    }
  });
