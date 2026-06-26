import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * GDPR Art. 9 — date HIV.
 *
 * Coloanele `hiv_status_enc` / `hiv_test_date_enc` din `public.profiles` sunt
 * cifrate cu pgcrypto. Decriptarea/criptarea se face DOAR prin RPC-urile
 * `public.get_user_health(uuid,text)` și `public.set_user_health(uuid,text,date,text)`,
 * care sunt grant-uite EXCLUSIV pentru `service_role`. Cheia (`HEALTH_COL_KEY`)
 * trăiește într-un secret de infrastructură și NU iese niciodată din server.
 *
 * Server fn-urile de mai jos sunt singura cale validă prin care UI-ul atinge
 * aceste date. `requireSupabaseAuth` garantează că `userId` este al apelantului
 * (clientul nu poate cere statusul altcuiva). Triggerele de pe `profiles`
 * blochează scrierea fără consimțământ `health_data` activ în `consent_log`.
 */

function readKey(): string {
  const key = process.env.HEALTH_COL_KEY;
  if (!key || key.length < 16) {
    throw new Error(
      "HEALTH_COL_KEY missing or too short. Adaugă secretul în Lovable Cloud (32+ caractere).",
    );
  }
  return key;
}

export const getMyHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_user_health", {
      _user_id: context.userId,
      _key: readKey(),
    });
    if (error) {
      console.error("[health] get_user_health", error);
      throw new Error("Nu am putut citi datele de sănătate.");
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      hiv_status: (row?.hiv_status ?? null) as string | null,
      hiv_test_date: (row?.hiv_test_date ?? null) as string | null,
    };
  });

const SetInput = z.object({
  hiv_status: z.string().trim().max(64).nullable(),
  hiv_test_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const setMyHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = data.hiv_status && data.hiv_status.length > 0 ? data.hiv_status : null;
    const testDate = data.hiv_test_date ?? null;
    const { error } = await supabaseAdmin.rpc("set_user_health", {
      _user_id: context.userId,
      _status: status,
      _date: testDate,
      _key: readKey(),
    });
    if (error) {
      // Triggerul DB întoarce `health_consent_required` dacă userul nu a consimțit.
      const msg = error.message || "";
      if (/health_consent_required/i.test(msg)) {
        return {
          ok: false as const,
          error: "consent_required" as const,
          message:
            "Pentru a salva date despre HIV trebuie să accepți consimțământul pentru date de sănătate (Art. 9 GDPR).",
        };
      }
      console.error("[health] set_user_health", error);
      throw new Error("Nu am putut salva datele de sănătate.");
    }
    // Actualizăm și timestamp-ul de consimțământ pentru transparență în profil.
    if (status || testDate) {
      await supabaseAdmin
        .from("profiles")
        .update({ health_data_consent_at: new Date().toISOString() })
        .eq("id", context.userId);
    }
    return { ok: true as const };
  });
