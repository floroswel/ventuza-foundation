/**
 * Traducere profile publice — pentru useri care aleg o limbă diferită față
 * de limba autorului. Rezultatele se cache-uiesc în `profile_translations`
 * (hash SHA-1 pe textul-sursă + limbă țintă) ca să nu re-cerem AI-ul.
 *
 * Gate:
 *  - `requireSupabaseAuth` (nu servim la anon, ca să evităm scraping).
 *  - Doar câmpuri publice: `bio`, `ideal_match`, `prompts` (JSONB).
 *
 * Nu atingem PII sensibil (orientare / locație / sănătate) — traducem doar
 * text descriptiv scris explicit de utilizator pentru afișare publică.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiComplete } from "./ai.server";

const Input = z.object({
  profileId: z.string().uuid(),
  targetLang: z.enum(["ro", "en", "es", "fr", "de", "it", "pt", "pl"]),
});

type Prompt = { q?: string; a?: string };

function hash(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 32);
}

async function translateOne(
  supabaseAdmin: any,
  profileId: string,
  field: string,
  text: string,
  targetLang: string,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const h = hash(trimmed);

  // cache lookup
  const { data: cached } = await supabaseAdmin
    .from("profile_translations")
    .select("translated")
    .eq("profile_id", profileId)
    .eq("field", field)
    .eq("text_hash", h)
    .eq("target_lang", targetLang)
    .maybeSingle();
  if (cached?.translated) return cached.translated;

  const langName: Record<string, string> = {
    ro: "Romanian",
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    pl: "Polish",
  };

  const out = await aiComplete({
    temperature: 0.2,
    maxTokens: 350,
    messages: [
      {
        role: "system",
        content:
          "You are a professional translator for a dating app profile. Translate the user's text into the target language. Preserve tone, emojis, and line breaks. Output ONLY the translated text — no quotes, no explanations, no language labels.",
      },
      {
        role: "user",
        content: `Target language: ${langName[targetLang]}\n\nText:\n${trimmed}`,
      },
    ],
  });

  const translated = out.trim();
  if (translated) {
    await supabaseAdmin
      .from("profile_translations")
      .upsert(
        {
          profile_id: profileId,
          field,
          text_hash: h,
          target_lang: targetLang,
          translated,
        },
        { onConflict: "profile_id,field,text_hash,target_lang" },
      );
  }
  return translated || text;
}

export const translateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin
      .from("profiles")
      .select("id, bio, ideal_match, prompts, preferred_language")
      .eq("id", data.profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Profile not found");

    // If author's stated language matches target, skip work.
    if (p.preferred_language && p.preferred_language === data.targetLang) {
      return {
        skipped: true as const,
        sourceLang: p.preferred_language,
        bio: p.bio,
        ideal_match: p.ideal_match,
        prompts: p.prompts,
      };
    }

    const [bio, ideal] = await Promise.all([
      p.bio ? translateOne(supabaseAdmin, p.id, "bio", p.bio, data.targetLang) : Promise.resolve(null),
      p.ideal_match
        ? translateOne(supabaseAdmin, p.id, "ideal_match", p.ideal_match, data.targetLang)
        : Promise.resolve(null),
    ]);

    let prompts: Prompt[] | null = null;
    if (Array.isArray(p.prompts) && p.prompts.length) {
      prompts = [];
      for (let i = 0; i < p.prompts.length; i++) {
        const raw = p.prompts[i] as Prompt;
        const a = raw?.a
          ? await translateOne(
              supabaseAdmin,
              p.id,
              `prompt_a_${i}`,
              raw.a,
              data.targetLang,
            )
          : raw?.a;
        prompts.push({ q: raw?.q, a });
      }
    }

    return {
      skipped: false as const,
      sourceLang: p.preferred_language ?? null,
      bio,
      ideal_match: ideal,
      prompts,
    };
  });
