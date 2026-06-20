import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiComplete } from "./ai.server";

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
  .inputValidator((d: unknown) => BioInput.parse(d))
  .handler(async ({ data }) => {
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
  .inputValidator((d: unknown) => OpenerInput.parse(d))
  .handler(async ({ data }) => {
    const sys =
      "Ești Wingman AI într-o app gay de dating. Generezi 3 mesaje de deschidere SCURTE (max 140 caractere fiecare), personalizate pe bio-ul/interesele celuilalt. Nu folosi „Salut" generic. Fără emoji excesiv. Răspunzi DOAR cu cele 3 opțiuni numerotate 1., 2., 3., fără explicații.";
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
  .inputValidator((d: unknown) => TranslateInput.parse(d))
  .handler(async ({ data }) => {
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
