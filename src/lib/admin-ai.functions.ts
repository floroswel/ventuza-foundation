import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  question: z.string().min(3).max(2000),
});

const SYSTEM = `Ești "Ventuza Copilot", asistent operațional pentru staff-ul admin al Ventuza (dating app gay, RO).
Răspunzi SCURT (max 8 rânduri), în română, cu pași concreți din panoul admin.
Cunoști modulele: Overview, Alerte, Utilizatori, Rapoarte, Risc, CSAM (no-render), DSA (anonim), GDPR Ops, Break-glass (super_admin), Breșe, Politici, Audit, Ads, B2B, Parteneri & Moderare, Securitate, Demo seed, System Health, Date.
Reguli inviolabile pe care trebuie să le respecți în sfaturi:
- Locația precisă, HIV, orientarea, mesajele brute, selfie verificare = doar prin Break-glass cu justificare ≥10 caractere; HIV+Locație+Orientare doar super_admin.
- CSAM nu se randează niciodată — doar hash, escaladare, blocare hash.
- Acțiunile de publicare venues/events/oferte trec DOAR prin moderare staff.
- Parametrii de business se schimbă din Securitate → Feature flags / app_settings, nu hardcodat.
Dacă întrebarea cere acces la date personale, refuză politicos și indică ruta Break-glass.
Nu inventezi RPC-uri sau coloane. Dacă nu știi sigur, spui "verifică în Date → tabela X".`;

export const adminAiCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: staff, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (error) throw new Error("Nu am putut verifica rolul.");
    if (staff !== true) throw new Error("forbidden: rol staff necesar.");

    const { aiComplete } = await import("./ai.server");
    const text = await aiComplete({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: data.question },
      ],
      temperature: 0.3,
      maxTokens: 400,
    });
    return { answer: text };
  });
