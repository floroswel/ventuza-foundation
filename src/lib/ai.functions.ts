import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiComplete } from "./ai.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Toate funcțiile AI sunt gated de consimțământul `ai_features` în consent_log.
 * Vezi AGENTS.md "REGULĂ — CONSIMȚĂMINTE (permanentă)" și src/lib/consent-registry.ts.
 */
async function requireAiConsent(supabase: { rpc: (fn: "has_active_consent", args: { _user_id: string; _kind: string }) => Promise<{ data: unknown; error: unknown }> }, userId: string) {
  const { data, error } = await supabase.rpc("has_active_consent", { _user_id: userId, _kind: "ai_features" });
  if (error) throw new Error("Nu am putut verifica consimțământul AI.");
  if (data !== true) {
    throw new Error("ai_consent_required: activează „Funcții AI” din Setări → Confidențialitate pentru a folosi această funcție.");
  }
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
