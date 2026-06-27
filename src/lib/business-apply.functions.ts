/**
 * Public server fn for submitting a business / partner application.
 *
 * Required because anon role has INSERT on business_applications but NO SELECT,
 * so the previous client-side `.insert().select().single()` was rejected by RLS
 * (PostgREST needs SELECT to return the inserted row). This endpoint bypasses
 * that limitation: it validates server-side and writes via supabaseAdmin, then
 * returns the new id.
 *
 * Security:
 * - validated with the same zod schema as the UI;
 * - the three accepts_* booleans are forced true (matches the previous WITH CHECK
 *   policy);
 * - user_id is read from the bearer (when present) — never trusted from input;
 * - no PII is logged.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const cuiRoRegex = /^(RO)?\d{2,10}$/i;

const Schema = z.object({
  entity_type: z.enum([
    "srl","pfa","ii","sa","ong","asociatie","fundatie","brand","organizator_eveniment","altul",
  ]),
  legal_name: z.string().trim().min(2).max(200),
  brand_name: z.string().trim().max(120).optional().nullable(),
  cui: z.string().trim().max(20).optional().nullable(),
  reg_com: z.string().trim().max(40).optional().nullable(),
  vat_number: z.string().trim().max(20).optional().nullable(),
  country: z.string().trim().length(2),
  city: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  contact_name: z.string().trim().min(2).max(120),
  contact_role: z.string().trim().max(80).optional().nullable(),
  contact_email: z.string().trim().email().max(200),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().url().max(200).optional().nullable(),
  social_links: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  goals: z.string().trim().min(20).max(2000),
  monthly_budget_eur: z.number().int().min(0).max(1_000_000).optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.country === "RO" && v.cui && !cuiRoRegex.test(v.cui)) {
    ctx.addIssue({ code: "custom", path: ["cui"], message: "CUI invalid (ex: RO12345678)" });
  }
});

function emptyToNull<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = { ...o };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "string" && (out[k] as string).trim() === "") out[k] = null;
  }
  return out as T;
}

export const submitBusinessApplication = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Schema.parse(emptyToNull((d ?? {}) as Record<string, unknown>)))
  .handler(async ({ data }) => {
    // Optional: attach user_id when caller is signed in (best-effort, never trusted from payload).
    let userId: string | null = null;
    try {
      const { getWebRequest } = await import("@tanstack/react-start/server");
      const req = getWebRequest();
      const auth = req?.headers.get("authorization") ?? "";
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
      if (token) {
        const { createClient } = await import("@supabase/supabase-js");
        const u = process.env.SUPABASE_URL!;
        const k = process.env.SUPABASE_PUBLISHABLE_KEY!;
        if (u && k) {
          const sb = createClient(u, k, { auth: { persistSession: false, autoRefreshToken: false } });
          const { data: ures } = await sb.auth.getUser(token);
          userId = ures?.user?.id ?? null;
        }
      }
    } catch { /* anonymous submission is OK */ }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const insertRow = {
      ...data,
      accepts_terms: true,
      accepts_dpa: true,
      accepts_lgbt_charter: true,
      user_id: userId,
    };
    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("business_applications")
      .insert(insertRow)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });
