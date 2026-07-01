import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertStaff(ctx: { userId: string; supabase: ReturnType<typeof Object> }) {
  const { data, error } = await (ctx.supabase as any).rpc("is_staff", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden: staff role required");
}
async function assertAdmin(ctx: { userId: string; supabase: ReturnType<typeof Object> }) {
  const { data, error } = await (ctx.supabase as any).rpc("is_admin_or_above", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden: admin role required");
}
async function logAudit(action: string, target_type: string, target_id: string | null, actor: string, meta: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("admin_audit_log").insert({
    actor_id: actor, action, target_type, target_id, after: meta, severity: "info",
  });
}

/* ================== NCMEC ================== */
export const adminListNcmecQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("csam_ncmec_queue")
      .select("id, csam_report_id, status, ncmec_case_id, narrative, hash_sha256, affected_country, error_msg, filed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const adminEnqueueNcmec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { csamReportId: string; narrative: string; country?: string }) =>
    z.object({ csamReportId: z.string().uuid(), narrative: z.string().min(20).max(4000), country: z.string().length(2).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rep, error: rerr } = await (supabaseAdmin as any).from("csam_reports").select("id, hash").eq("id", data.csamReportId).maybeSingle();
    if (rerr || !rep) throw new Error("csam report not found");
    const { data: q, error } = await (supabaseAdmin as any).from("csam_ncmec_queue").insert({
      csam_report_id: rep.id,
      narrative: data.narrative,
      hash_sha256: rep.hash,
      affected_country: data.country ?? null,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit("ncmec.enqueue", "csam_reports", rep.id, context.userId, { queue_id: q.id });
    return { id: q.id };
  });

export const adminMarkNcmecFiled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { queueId: string; ncmecCaseId: string }) =>
    z.object({ queueId: z.string().uuid(), ncmecCaseId: z.string().min(2).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("csam_ncmec_queue").update({
      status: "filed", ncmec_case_id: data.ncmecCaseId, filed_by: context.userId, filed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", data.queueId);
    if (error) throw new Error(error.message);
    await logAudit("ncmec.filed", "csam_ncmec_queue", data.queueId, context.userId, { case: data.ncmecCaseId });
    return { ok: true };
  });

/* ================== BREACH 72h ================== */
export const adminGenerateArt33Draft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { breachId: string }) => z.object({ breachId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: b, error } = await (context.supabase as any).from("breach_incidents").select("*").eq("id", data.breachId).maybeSingle();
    if (error || !b) throw new Error("breach not found");
    const art33 = `NOTIFICARE ANSPDCP — Art. 33 GDPR
Operator: VOMIX GENIUS S.R.L. (Ventuza)
Data descoperirii: ${new Date(b.discovered_at).toLocaleString("ro-RO")}
Termen 72h: ${new Date(b.notify_deadline).toLocaleString("ro-RO")}
Severitate: ${b.severity}

1. NATURA INCIDENTULUI
${b.description ?? "(de completat)"}

2. CATEGORII DE DATE AFECTATE
${(b.data_categories ?? []).join(", ") || "(de completat)"}

3. CATEGORII ȘI NUMĂR PERSOANE VIZATE
Aproximativ ${b.affected_users_count ?? "?"} persoane vizate.

4. CONSECINȚE PROBABILE
[de evaluat — furt identitate, discriminare, prejudiciu reputațional, risc fizic pentru comunitatea LGBTQ+ în cazul expunerii orientării sexuale sau locației]

5. MĂSURI DE CONTAINMENT
${b.containment_actions ?? "(de completat)"}

6. CAUZA RADICALĂ
${b.root_cause ?? "(în investigație)"}

7. DPO / PUNCT CONTACT
${b.dpo_contact ?? "dpo@ventuza.eu"}

8. NOTIFICARE PERSOANE VIZATE (Art. 34)
[Da / Nu — motiv]

Semnătură reprezentant legal: __________________
Data: ${new Date().toLocaleDateString("ro-RO")}`;
    const art34 = `Subiect: Notificare importantă privind securitatea contului tău Ventuza

Bună,

Îți scriem pentru a te informa despre un incident de securitate identificat pe ${new Date(b.discovered_at).toLocaleDateString("ro-RO")}, care ar fi putut afecta datele tale.

CE S-A ÎNTÂMPLAT
${b.description ?? "[descriere pe înțelesul userului]"}

CE DATE AU FOST IMPLICATE
${(b.data_categories ?? []).join(", ") || "[categorii]"}

CE FACEM
${b.containment_actions ?? "[măsuri]"}

CE POȚI FACE TU
- Schimbă parola
- Activează 2FA
- Fii vigilent la mesaje de phishing

Ne pare rău pentru neplăceri și îți mulțumim pentru încrederea acordată.
Echipa Ventuza | dpo@ventuza.eu`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("breach_incidents").update({ art33_draft: art33, art34_draft: art34 }).eq("id", data.breachId);
    return { art33_draft: art33, art34_draft: art34 };
  });

export const adminUpdateBreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { breachId: string; patch: Record<string, unknown> }) =>
    z.object({ breachId: z.string().uuid(), patch: z.record(z.any()) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const allowed = ["title","description","severity","data_categories","affected_users_count","dpo_contact","containment_actions","root_cause","status","authority_notified_at","users_notified_at","closed_at","art33_draft","art34_draft"];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in data.patch) patch[k] = data.patch[k];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("breach_incidents").update(patch).eq("id", data.breachId);
    if (error) throw new Error(error.message);
    await logAudit("breach.update", "breach_incidents", data.breachId, context.userId, patch);
    return { ok: true };
  });

export const adminAddBreachEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { breachId: string; kind: string; note: string }) =>
    z.object({ breachId: z.string().uuid(), kind: z.string().min(2).max(80), note: z.string().min(2).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).rpc("breach_add_timeline_event", { _breach_id: data.breachId, _kind: data.kind, _note: data.note });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ================== DSA SoR ================== */
export const adminListDsaSor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await (context.supabase as any).from("dsa_sor")
      .select("id, action_type, target_user_id, target_content_type, legal_basis, category, reasoning, automated, redress_deadline, transparency_reported, created_at")
      .order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const adminCreateDsaSor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    action_type: string; target_user_id?: string | null; target_content_type?: string | null; target_content_id?: string | null;
    legal_basis: string; category: string; reasoning: string; automated?: boolean;
  }) => z.object({
    action_type: z.enum(["content_removed","content_demoted","account_suspended","account_banned","account_restricted","feature_restricted"]),
    target_user_id: z.string().uuid().nullish(),
    target_content_type: z.string().nullish(),
    target_content_id: z.string().nullish(),
    legal_basis: z.enum(["tos_violation","illegal_content_local","illegal_content_eu","dsa_notice","court_order","safety_measure"]),
    category: z.string().min(2).max(120),
    reasoning: z.string().min(20).max(4000),
    automated: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: id, error } = await (context.supabase as any).rpc("dsa_record_sor", {
      _action_type: data.action_type,
      _target_user_id: data.target_user_id ?? null,
      _target_content_type: data.target_content_type ?? null,
      _target_content_id: data.target_content_id ?? null,
      _legal_basis: data.legal_basis,
      _category: data.category,
      _reasoning: data.reasoning,
      _automated: data.automated ?? false,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const adminExportDsaTransparency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number; month?: number | null }) =>
    z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12).nullish() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const start = new Date(Date.UTC(data.year, (data.month ?? 1) - 1, 1));
    const end = data.month
      ? new Date(Date.UTC(data.year, data.month, 1))
      : new Date(Date.UTC(data.year + 1, 0, 1));
    const { data: rows, error } = await (context.supabase as any).from("dsa_sor")
      .select("action_type, legal_basis, category, automated, created_at")
      .gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    if (error) throw new Error(error.message);
    const totals: Record<string, number> = {};
    for (const r of rows ?? []) {
      const k = `${r.action_type}|${r.legal_basis}|${r.automated ? "auto" : "human"}`;
      totals[k] = (totals[k] ?? 0) + 1;
    }
    return { period: { start: start.toISOString(), end: end.toISOString() }, total: rows?.length ?? 0, breakdown: totals };
  });

/* ================== COUNTRY RISK ================== */
export const adminListCountryRisk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any).from("country_risk_config")
      .select("*").order("risk_level", { ascending: false }).order("country_code");
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const adminUpsertCountryRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    country_code: string; country_name: string; risk_level: string;
    hide_precise_location: boolean; force_stealth: boolean; disable_discover: boolean; disable_signup: boolean; reason?: string;
  }) => z.object({
    country_code: z.string().length(2),
    country_name: z.string().min(2).max(120),
    risk_level: z.enum(["normal","elevated","high","blocked"]),
    hide_precise_location: z.boolean(),
    force_stealth: z.boolean(),
    disable_discover: z.boolean(),
    disable_signup: z.boolean(),
    reason: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("country_risk_config").upsert({
      ...data,
      country_code: data.country_code.toUpperCase(),
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await logAudit("country_risk.upsert", "country_risk_config", data.country_code.toUpperCase(), context.userId, data);
    return { ok: true };
  });

export const adminDeleteCountryRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { country_code: string }) => z.object({ country_code: z.string().length(2) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("country_risk_config").delete().eq("country_code", data.country_code.toUpperCase());
    if (error) throw new Error(error.message);
    await logAudit("country_risk.delete", "country_risk_config", data.country_code.toUpperCase(), context.userId, {});
    return { ok: true };
  });

/* ================== ANAF e-FACTURA ================== */
function generateUblXml(inv: Record<string, any>, billing: Record<string, any>, issuer: Record<string, any>): string {
  const esc = (s: unknown) => String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '"':"&quot;" }[c] as string));
  const invoiceNumber = `${inv.series}${String(inv.number).padStart(6, "0")}`;
  const issueDate = new Date(inv.issued_at).toISOString().slice(0,10);
  const dueDate = new Date(inv.due_at).toISOString().slice(0,10);
  const subtotal = (inv.subtotal_minor / 100).toFixed(2);
  const vat = (inv.vat_minor / 100).toFixed(2);
  const total = (inv.total_minor / 100).toFixed(2);
  const description = inv.kind === "boost" ? "Serviciu boost partener" : `Abonament partener ${inv.plan_code ?? ""}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>${esc(invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${esc(inv.currency)}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyName><cbc:Name>${esc(issuer.name)}</cbc:Name></cac:PartyName>
    <cac:PostalAddress>
      <cbc:StreetName>${esc(issuer.address)}</cbc:StreetName>
      <cbc:CityName>${esc(issuer.city)}</cbc:CityName>
      <cac:Country><cbc:IdentificationCode>RO</cbc:IdentificationCode></cac:Country>
    </cac:PostalAddress>
    <cac:PartyTaxScheme>
      <cbc:CompanyID>${esc(issuer.cui)}</cbc:CompanyID>
      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
    </cac:PartyTaxScheme>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName>${esc(issuer.legal_name)}</cbc:RegistrationName>
      <cbc:CompanyID>${esc(issuer.reg_com)}</cbc:CompanyID>
    </cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyName><cbc:Name>${esc(billing.company_name ?? billing.name)}</cbc:Name></cac:PartyName>
    <cac:PostalAddress>
      <cbc:StreetName>${esc(billing.address ?? "")}</cbc:StreetName>
      <cbc:CityName>${esc(billing.city ?? "")}</cbc:CityName>
      <cac:Country><cbc:IdentificationCode>${esc(billing.country ?? "RO")}</cbc:IdentificationCode></cac:Country>
    </cac:PostalAddress>
    <cac:PartyTaxScheme>
      <cbc:CompanyID>${esc(billing.cui ?? billing.vat_id ?? "")}</cbc:CompanyID>
      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
    </cac:PartyTaxScheme>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName>${esc(billing.company_name ?? billing.name)}</cbc:RegistrationName>
    </cac:PartyLegalEntity>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${esc(inv.currency)}">${vat}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${esc(inv.currency)}">${subtotal}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${esc(inv.currency)}">${vat}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${inv.vat_rate}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${esc(inv.currency)}">${subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${esc(inv.currency)}">${subtotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${esc(inv.currency)}">${total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${esc(inv.currency)}">${total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${esc(inv.currency)}">${subtotal}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(description)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID><cbc:Percent>${inv.vat_rate}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${esc(inv.currency)}">${subtotal}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;
}

export const adminListEfacturaQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("anaf_efactura_queue")
      .select("id, invoice_id, status, anaf_upload_id, submitted_at, error_msg, attempts, created_at, updated_at, partner_invoices!inner(series, number, year, total_minor, currency, status, billing_snapshot)")
      .order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const adminGenerateEfacturaXml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { queueId: string }) => z.object({ queueId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q, error } = await (supabaseAdmin as any).from("anaf_efactura_queue")
      .select("id, invoice_id, partner_invoices(*)").eq("id", data.queueId).maybeSingle();
    if (error || !q) throw new Error("queue item not found");
    const inv = q.partner_invoices;
    const xml = generateUblXml(inv, inv.billing_snapshot ?? {}, inv.issuer_snapshot ?? {});
    await (supabaseAdmin as any).from("anaf_efactura_queue").update({
      ubl_xml: xml, status: "generated", updated_at: new Date().toISOString(),
    }).eq("id", data.queueId);
    await logAudit("efactura.generated", "anaf_efactura_queue", data.queueId, context.userId, { invoice_id: inv.id });
    return { xml };
  });

export const adminMarkEfacturaSubmitted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { queueId: string; anafUploadId: string; status?: "submitted" | "accepted" | "rejected" }) =>
    z.object({ queueId: z.string().uuid(), anafUploadId: z.string().min(2).max(200), status: z.enum(["submitted","accepted","rejected"]).default("submitted") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("anaf_efactura_queue").update({
      status: data.status, anaf_upload_id: data.anafUploadId, submitted_at: new Date().toISOString(),
      submitted_by: context.userId, updated_at: new Date().toISOString(),
    }).eq("id", data.queueId);
    if (error) throw new Error(error.message);
    await logAudit(`efactura.${data.status}`, "anaf_efactura_queue", data.queueId, context.userId, { upload: data.anafUploadId });
    return { ok: true };
  });
