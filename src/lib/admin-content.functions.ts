/**
 * EXTRA CRITICE — admin content / billing tools.
 *
 *  - adminRedactMessage:  redactare/ștergere mesaj individual din convo
 *                         raportată; păstrează contextul (mesajul rămâne în
 *                         conversație, doar body/media/voice sunt șterse +
 *                         marcat `deleted_at`). Audit cu before snapshot.
 *  - adminUpdatePartnerItem: editare directă venue/event partener (telefon
 *                         greșit, adresă etc.). Nu schimbă moderation_status
 *                         (staff edit = trusted), audit complet.
 *  - adminVoidInvoice:   storno + reemitere corect contabil. Original devine
 *                         `status='voided'`; se inserează un credit-note cu
 *                         totaluri negative, snapshot fiscal IMUTABIL preluat
 *                         din original. Numărare prin `next_invoice_number`.
 *
 * Toate cer rol staff potrivit + MFA + justification ≥ 10 + audit before→after.
 * Niciun câmp Art. 9 / locație precisă proiectat.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole =
  | "super_admin" | "admin" | "auditor" | "moderator" | "support" | "read_only";

async function reqMeta() {
  let ip: string | null = null;
  let ua: string | null = null;
  try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch {}
  try { ua = getRequestHeader("user-agent") ?? null; } catch {}
  return { ip, ua };
}

async function assertRole(supabase: any, userId: string, roles: AppRole[]) {
  const { data, error } = await supabase.rpc("has_any_role", { _user_id: userId, _roles: roles });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: rol insuficient");
}

async function logAudit(opts: {
  actorId: string; action: string;
  targetTable?: string | null; targetId?: string | null;
  before?: any; after?: any; justification?: string | null;
  severity?: "info" | "warning" | "critical";
}) {
  const meta = await reqMeta();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("admin_audit_log").insert({
    actor_id: opts.actorId, action: opts.action,
    target_table: opts.targetTable ?? null, target_id: opts.targetId ?? null,
    before_data: opts.before ?? null, after_data: opts.after ?? null,
    justification: opts.justification ?? null,
    severity: opts.severity ?? "info",
    ip: meta.ip, user_agent: meta.ua,
  });
}

/* ============================================================
 * REDACT MESSAGE (individual) — DSA / conținut ilegal in-place
 * Păstrează rândul; șterge body, media_url, voice_url; marcat deleted_at.
 * Rol: moderator+; MFA cerut.
 * ============================================================ */
const RedactInput = z.object({
  messageId: z.string().uuid(),
  justification: z.string().trim().min(10).max(500),
});

export const adminRedactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RedactInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId,
      ["super_admin", "admin", "moderator"]);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    // Snapshot complet (PII inclus) — rămâne DOAR în admin_audit_log.before_data,
    // vizibil exclusiv pentru auditor/super_admin. Conform regulii Break-Glass.
    const { data: before, error: e0 } = await sa.from("messages")
      .select("id, conversation_id, sender_id, body, media_url, media_type, voice_url, voice_duration_sec, created_at, deleted_at")
      .eq("id", data.messageId).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!before) throw new Error("Mesaj inexistent");
    if (before.deleted_at) throw new Error("Mesajul e deja redactat/șters");

    const patch = {
      body: "[REDACTED by staff — conținut ilegal / abuziv]",
      media_url: null,
      media_type: null,
      voice_url: null,
      voice_duration_sec: null,
      deleted_at: new Date().toISOString(),
    };
    const { error } = await sa.from("messages").update(patch).eq("id", data.messageId);
    if (error) throw new Error(error.message);

    await logAudit({
      actorId: context.userId, action: "message.redact",
      targetTable: "messages", targetId: data.messageId,
      before, after: patch,
      justification: data.justification, severity: "critical",
    });
    return { ok: true as const };
  });

/* ============================================================
 * UPDATE PARTNER ITEM (venue / event) — staff edit
 * Câmpuri permise:
 *   venue:  name, description, address, phone_e164, website, opening_hours
 *   event:  title, description, venue (text), starts_at, ends_at
 * Staff edit NU re-trigger-uiește moderarea (e o corecție de încredere).
 * Rol: admin+; MFA cerut.
 * ============================================================ */
const PartnerVenueChanges = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(255).optional(),
  phone_e164: z.string().trim().max(20).optional(),
  website: z.string().trim().max(500).optional(),
  opening_hours: z.string().trim().max(500).optional(),
}).refine((c) => Object.keys(c).length > 0, { message: "Niciun câmp" });

const PartnerEventChanges = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  venue: z.string().trim().max(120).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
}).refine((c) => Object.keys(c).length > 0, { message: "Niciun câmp" });

const PartnerItemInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("venue"),
    itemId: z.string().uuid(),
    changes: PartnerVenueChanges,
    justification: z.string().trim().min(10).max(500),
  }),
  z.object({
    kind: z.literal("event"),
    itemId: z.string().uuid(),
    changes: PartnerEventChanges,
    justification: z.string().trim().min(10).max(500),
  }),
]);

export const adminUpdatePartnerItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PartnerItemInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin"]);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const table = data.kind === "venue" ? "venues" : "events";
    const cols = Object.keys(data.changes).join(",") + ",owner_id,host_id";

    const { data: before, error: e0 } = await sa.from(table)
      .select(cols).eq("id", data.itemId).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!before) throw new Error("Item inexistent");

    const { error } = await sa.from(table).update(data.changes).eq("id", data.itemId);
    if (error) throw new Error(error.message);

    await logAudit({
      actorId: context.userId, action: `partner.${data.kind}.update`,
      targetTable: table, targetId: data.itemId,
      before, after: data.changes,
      justification: data.justification, severity: "warning",
    });
    return { ok: true as const };
  });

/* ============================================================
 * VOID INVOICE — storno + reemitere corect contabil
 * Reguli:
 *   - Doar facturi `issued` sau `paid` pot fi anulate.
 *   - Snapshot fiscal IMUTABIL (billing_snapshot / issuer_snapshot) preluat
 *     din original — nu se editează retroactiv.
 *   - Storno = invoice nou, kind='storno', cu totaluri NEGATIVE, status
 *     identic cu originalul ('paid'/'issued'), număr atomic prin
 *     `next_invoice_number(series, year)`.
 *   - Original devine `status='voided'`.
 *   - Rol: super_admin (decizie financiară). MFA cerut.
 * ============================================================ */
const VoidInvoiceInput = z.object({
  invoiceId: z.string().uuid(),
  justification: z.string().trim().min(10).max(500),
});

export const adminVoidInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VoidInvoiceInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin"]);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    const { data: orig, error: e0 } = await sa.from("partner_invoices")
      .select("*").eq("id", data.invoiceId).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!orig) throw new Error("Factură inexistentă");
    if (orig.status === "voided") throw new Error("Factura e deja anulată");
    if (orig.kind === "storno") throw new Error("Nu poți anula o factură storno");
    if (!["issued", "paid", "overdue", "grace"].includes(orig.status)) {
      throw new Error(`Status incompatibil cu anularea: ${orig.status}`);
    }

    // Alocă număr nou pentru storno în aceeași serie/an.
    const year = new Date().getFullYear();
    const { data: nextNum, error: nErr } = await sa.rpc("next_invoice_number", {
      _series: orig.series, _year: year,
    });
    if (nErr) throw new Error(`next_invoice_number: ${nErr.message}`);

    const nowIso = new Date().toISOString();
    const stornoRow = {
      owner_id: orig.owner_id,
      series: orig.series,
      number: nextNum,
      year,
      payment_code: orig.payment_code,
      kind: "storno",
      plan_code: orig.plan_code,
      boost_event_id: orig.boost_event_id,
      period_start: orig.period_start,
      period_end: orig.period_end,
      currency: orig.currency,
      subtotal_minor: -Math.abs(orig.subtotal_minor ?? 0),
      vat_rate: orig.vat_rate,
      vat_minor: -Math.abs(orig.vat_minor ?? 0),
      total_minor: -Math.abs(orig.total_minor ?? 0),
      status: orig.status === "paid" ? "paid" : "issued",
      issued_at: nowIso,
      due_at: orig.due_at,
      paid_at: orig.status === "paid" ? nowIso : null,
      paid_amount_minor: orig.status === "paid" ? -Math.abs(orig.paid_amount_minor ?? 0) : null,
      paid_ref: orig.paid_ref,
      confirmed_by: orig.status === "paid" ? context.userId : null,
      notes: `STORNO factura ${orig.series}-${orig.year}-${String(orig.number).padStart(6, "0")} — ${data.justification}`,
      // Snapshots IMUTABILE — preluate din original.
      billing_snapshot: orig.billing_snapshot,
      issuer_snapshot: orig.issuer_snapshot,
      is_seed: orig.is_seed ?? false,
    };

    const { data: storno, error: sErr } = await sa.from("partner_invoices")
      .insert(stornoRow).select("id, series, year, number").maybeSingle();
    if (sErr) throw new Error(`Storno: ${sErr.message}`);

    // Marchează originalul ca anulat.
    const { error: uErr } = await sa.from("partner_invoices")
      .update({ status: "voided", notes: (orig.notes ?? "") + `\n[VOID @ ${nowIso}] ${data.justification}` })
      .eq("id", orig.id);
    if (uErr) throw new Error(`Mark voided: ${uErr.message}`);

    await logAudit({
      actorId: context.userId, action: "invoice.void",
      targetTable: "partner_invoices", targetId: orig.id,
      before: { status: orig.status, total_minor: orig.total_minor },
      after: { status: "voided", storno_id: storno?.id, storno_number: storno?.number },
      justification: data.justification, severity: "critical",
    });
    return { ok: true as const, storno };
  });
