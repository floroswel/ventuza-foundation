/**
 * Jurnal de audit pentru fluxul de cont nou (confirmare email + Didit).
 * Scrierea trece prin RPC `record_account_flow_event` (SECURITY DEFINER),
 * care leagă evenimentul de userul autentificat — clientul nu poate falsifica
 * user_id-ul. Detaliile sunt tehnice (coduri de stare), fără PII.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eventSchema = z.object({
  kind: z.enum(["email_confirmation", "didit", "password_reset"]),
  stage: z.string().min(1).max(64),
  detail: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export const logAccountFlowEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => eventSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("record_account_flow_event", {
      _kind: data.kind,
      _stage: data.stage,
      _detail: (data.detail ?? {}) as never,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const getMyAccountFlowEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("account_flow_events")
      .select("id, kind, stage, detail, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) return { events: [] as never[], error: error.message };
    return { events: data ?? [], error: null as string | null };
  });
