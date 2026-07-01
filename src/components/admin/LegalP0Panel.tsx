import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Send, FileText, Globe, Download, AlertOctagon, Plus, Trash2 } from "lucide-react";
import { GlassCard, SectionTitle } from "@/components/admin/ui/primitives";
import {
  adminListNcmecQueue, adminEnqueueNcmec, adminMarkNcmecFiled,
  adminGenerateArt33Draft, adminUpdateBreach, adminAddBreachEvent,
  adminListDsaSor, adminCreateDsaSor, adminExportDsaTransparency,
  adminListCountryRisk, adminUpsertCountryRisk, adminDeleteCountryRisk,
  adminListEfacturaQueue, adminGenerateEfacturaXml, adminMarkEfacturaSubmitted,
} from "@/lib/admin-legal.functions";
import { supabase } from "@/integrations/supabase/client";

type Tab = "ncmec" | "breach" | "dsa" | "country" | "efactura";

export function LegalP0Panel() {
  const [tab, setTab] = useState<Tab>("ncmec");
  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "ncmec", label: "NCMEC (CSAM)", icon: ShieldAlert },
    { id: "breach", label: "Breach 72h", icon: AlertOctagon },
    { id: "dsa", label: "DSA SoR", icon: FileText },
    { id: "country", label: "Country risk", icon: Globe },
    { id: "efactura", label: "e-Factura ANAF", icon: Send },
  ];
  return (
    <div className="space-y-4">
      <SectionTitle>Legal survival — P0</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition
                ${active ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}>
              <Icon className="size-3.5" />{t.label}
            </button>
          );
        })}
      </div>
      {tab === "ncmec" && <NcmecTab />}
      {tab === "breach" && <BreachTab />}
      {tab === "dsa" && <DsaSorTab />}
      {tab === "country" && <CountryTab />}
      {tab === "efactura" && <EfacturaTab />}
    </div>
  );
}

function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">
      <p className="font-medium">{/forbidden|denied|role/i.test(error) ? "Acces refuzat" : "Eroare"}</p>
      <p className="mt-1 text-xs opacity-80">{error}</p>
      {retry && <button onClick={retry} className="mt-2 text-xs underline">Reîncearcă</button>}
    </div>
  );
}

/* ---------- NCMEC ---------- */
function NcmecTab() {
  const list = useServerFn(adminListNcmecQueue);
  const enqueue = useServerFn(adminEnqueueNcmec);
  const markFiled = useServerFn(adminMarkNcmecFiled);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [narrative, setNarrative] = useState("");
  const [country, setCountry] = useState("RO");
  const [caseId, setCaseId] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [q, r] = await Promise.all([
        list(),
        supabase.from("csam_reports").select("id, status, notes, reported_at, hash").eq("status", "pending").order("reported_at", { ascending: false }).limit(50),
      ]);
      setRows(q.rows); setReports(r.data ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!selected || narrative.length < 20) { toast.error("Selectează raport + narativ ≥ 20 caractere"); return; }
    try {
      await enqueue({ data: { csamReportId: selected, narrative, country: country.toUpperCase() } });
      toast.success("Adăugat în coada NCMEC");
      setSelected(""); setNarrative("");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Se încarcă…</div>;
  if (error) return <ErrorBox error={error} retry={load} />;

  return (
    <div className="space-y-4">
      <GlassCard>
        <p className="mb-3 text-sm font-medium">Escaladează raport CSAM către NCMEC</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Raport pending ({reports.length})</label>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}
              className="mt-1 w-full rounded-md border border-border/40 bg-background p-2 text-sm">
              <option value="">— alege —</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>{new Date(r.reported_at).toLocaleDateString("ro-RO")} · hash {String(r.hash ?? "").slice(0, 12)}…</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Țara raportorului / conținutului (ISO2)</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2}
              className="mt-1 w-full rounded-md border border-border/40 bg-background p-2 text-sm uppercase" />
          </div>
        </div>
        <label className="mt-3 block text-xs text-muted-foreground">Narativ CyberTipline (≥ 20 caractere)</label>
        <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={4}
          className="mt-1 w-full rounded-md border border-border/40 bg-background p-2 text-sm"
          placeholder="Descriere concisă a materialului, contextul detecției, cont user, măsuri interne luate…" />
        <button onClick={submit} className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
          Escaladează la NCMEC
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          Submisia finală la NCMEC CyberTipline se face manual (encrypted email / API key). Aici pregătim pachetul + urmă audit.
        </p>
      </GlassCard>

      <GlassCard>
        <p className="mb-3 text-sm font-medium">Coadă ({rows.length})</p>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/40 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 font-medium ${
                  r.status === "filed" ? "bg-emerald-500/20 text-emerald-300" :
                  r.status === "failed" ? "bg-red-500/20 text-red-300" :
                  "bg-amber-500/20 text-amber-300"}`}>{r.status}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("ro-RO")}</span>
                {r.affected_country && <span className="text-muted-foreground">· {r.affected_country}</span>}
                {r.ncmec_case_id && <span className="ml-auto font-mono">Case: {r.ncmec_case_id}</span>}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{r.narrative}</p>
              {r.status === "queued" && (
                <div className="mt-2 flex gap-2">
                  <input placeholder="NCMEC Case ID" value={caseId[r.id] ?? ""} onChange={(e) => setCaseId({ ...caseId, [r.id]: e.target.value })}
                    className="flex-1 rounded border border-border/40 bg-background p-1.5 text-xs" />
                  <button onClick={async () => {
                    if (!caseId[r.id]) return;
                    try { await markFiled({ data: { queueId: r.id, ncmecCaseId: caseId[r.id] } }); toast.success("Marcat filed"); load(); }
                    catch (e: any) { toast.error(e.message); }
                  }} className="rounded bg-emerald-600 px-2 text-xs text-white">Marchează filed</button>
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="text-xs text-muted-foreground">Coada este goală.</p>}
        </div>
      </GlassCard>
    </div>
  );
}

/* ---------- BREACH 72h ---------- */
function BreachTab() {
  const generate = useServerFn(adminGenerateArt33Draft);
  const update = useServerFn(adminUpdateBreach);
  const addEvent = useServerFn(adminAddBreachEvent);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<any>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error: e } = await supabase.from("breach_incidents").select("*").order("discovered_at", { ascending: false }).limit(50);
    if (e) setError(e.message); else setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (sel) { const fresh = rows.find((r) => r.id === sel.id); if (fresh) setSel(fresh); } }, [rows]);

  const createNew = async () => {
    const title = prompt("Titlu incident:");
    if (!title) return;
    const { error: e } = await supabase.from("breach_incidents").insert({ title });
    if (e) toast.error(e.message); else { toast.success("Incident creat — start ceas 72h"); load(); }
  };

  if (loading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Se încarcă…</div>;
  if (error) return <ErrorBox error={error} retry={load} />;

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Incidente ({rows.length})</p>
          <button onClick={createNew} className="rounded bg-red-600 px-2 py-1 text-xs text-white">+ Nou</button>
        </div>
        <div className="space-y-1.5">
          {rows.map((r) => {
            const dl = new Date(r.notify_deadline).getTime();
            const now = Date.now();
            const hoursLeft = Math.round((dl - now) / 3600000);
            const overdue = hoursLeft < 0 && !r.authority_notified_at;
            return (
              <button key={r.id} onClick={() => setSel(r)}
                className={`w-full rounded-lg border p-2 text-left text-xs ${sel?.id === r.id ? "border-primary bg-primary/10" : "border-border/40"}`}>
                <p className="font-medium truncate">{r.title}</p>
                <p className={`mt-0.5 ${overdue ? "text-red-400" : hoursLeft < 24 ? "text-amber-400" : "text-muted-foreground"}`}>
                  {r.authority_notified_at ? "✓ notificat" : overdue ? `⚠️ DEPĂȘIT ${Math.abs(hoursLeft)}h` : `${hoursLeft}h până termen`}
                </p>
                <p className="text-muted-foreground">{r.severity} · {r.status}</p>
              </button>
            );
          })}
          {rows.length === 0 && <p className="text-xs text-muted-foreground">Niciun incident.</p>}
        </div>
      </GlassCard>

      {sel ? (
        <GlassCard>
          <BreachEditor incident={sel} onSave={async (patch) => {
            try { await update({ data: { breachId: sel.id, patch } }); toast.success("Salvat"); load(); }
            catch (e: any) { toast.error(e.message); }
          }} onGenerate={async () => {
            try { const r = await generate({ data: { breachId: sel.id } }); toast.success("Draft-uri generate"); setSel({ ...sel, art33_draft: r.art33_draft, art34_draft: r.art34_draft }); load(); }
            catch (e: any) { toast.error(e.message); }
          }} onAddEvent={async (kind, note) => {
            try { await addEvent({ data: { breachId: sel.id, kind, note } }); toast.success("Adăugat în timeline"); load(); }
            catch (e: any) { toast.error(e.message); }
          }} />
        </GlassCard>
      ) : (
        <GlassCard><p className="text-sm text-muted-foreground">Selectează un incident sau creează unul nou.</p></GlassCard>
      )}
    </div>
  );
}

function BreachEditor({ incident, onSave, onGenerate, onAddEvent }: {
  incident: any; onSave: (patch: Record<string, unknown>) => void;
  onGenerate: () => void; onAddEvent: (kind: string, note: string) => void;
}) {
  const [form, setForm] = useState<any>(incident);
  useEffect(() => { setForm(incident); }, [incident.id]);
  const [evKind, setEvKind] = useState("investigation");
  const [evNote, setEvNote] = useState("");

  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });
  const dueLabel = new Date(incident.notify_deadline).toLocaleString("ro-RO");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold">{incident.title}</p>
        <p className="text-xs text-muted-foreground">Descoperit: {new Date(incident.discovered_at).toLocaleString("ro-RO")} · Termen ANSPDCP: {dueLabel}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs">Titlu
          <input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
        </label>
        <label className="text-xs">Severitate
          <select value={form.severity} onChange={(e) => set("severity", e.target.value)} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm">
            <option>low</option><option>medium</option><option>high</option><option>critical</option>
          </select>
        </label>
        <label className="text-xs">Status
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm">
            <option>open</option><option>contained</option><option>notified</option><option>closed</option>
          </select>
        </label>
        <label className="text-xs">Useri afectați (aprox)
          <input type="number" value={form.affected_users_count ?? ""} onChange={(e) => set("affected_users_count", parseInt(e.target.value) || null)} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
        </label>
        <label className="text-xs md:col-span-2">Categorii date (virgulă)
          <input value={(form.data_categories ?? []).join(",")} onChange={(e) => set("data_categories", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
        </label>
        <label className="text-xs md:col-span-2">Descriere
          <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
        </label>
        <label className="text-xs md:col-span-2">Containment
          <textarea value={form.containment_actions ?? ""} onChange={(e) => set("containment_actions", e.target.value)} rows={2} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
        </label>
        <label className="text-xs md:col-span-2">Cauză radicală
          <textarea value={form.root_cause ?? ""} onChange={(e) => set("root_cause", e.target.value)} rows={2} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onSave({
          title: form.title, severity: form.severity, status: form.status, description: form.description,
          affected_users_count: form.affected_users_count, data_categories: form.data_categories,
          containment_actions: form.containment_actions, root_cause: form.root_cause,
        })} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">Salvează</button>
        <button onClick={onGenerate} className="rounded border border-border/40 px-3 py-1.5 text-sm">Generează draft Art. 33/34</button>
        {!form.authority_notified_at && (
          <button onClick={() => onSave({ authority_notified_at: new Date().toISOString(), status: "notified" })}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white">Marchează ANSPDCP notificat</button>
        )}
        {!form.closed_at && (
          <button onClick={() => onSave({ closed_at: new Date().toISOString(), status: "closed" })}
            className="rounded border border-border/40 px-3 py-1.5 text-sm">Închide incident</button>
        )}
      </div>

      {form.art33_draft && (
        <details className="rounded-lg border border-border/40 p-3">
          <summary className="cursor-pointer text-sm font-medium">Draft Art. 33 (ANSPDCP)</summary>
          <textarea value={form.art33_draft} onChange={(e) => set("art33_draft", e.target.value)} rows={16} className="mt-2 w-full rounded border border-border/40 bg-background p-2 font-mono text-xs" />
        </details>
      )}
      {form.art34_draft && (
        <details className="rounded-lg border border-border/40 p-3">
          <summary className="cursor-pointer text-sm font-medium">Draft Art. 34 (userii vizați)</summary>
          <textarea value={form.art34_draft} onChange={(e) => set("art34_draft", e.target.value)} rows={12} className="mt-2 w-full rounded border border-border/40 bg-background p-2 text-xs" />
        </details>
      )}

      <div className="rounded-lg border border-border/40 p-3">
        <p className="text-sm font-medium">Timeline ({(incident.timeline ?? []).length})</p>
        <div className="mt-2 space-y-1 text-xs">
          {(incident.timeline ?? []).map((e: any, i: number) => (
            <div key={i} className="border-l-2 border-primary/50 pl-2">
              <span className="font-mono text-muted-foreground">{new Date(e.at).toLocaleString("ro-RO")}</span>
              {" · "}<span className="font-medium">{e.kind}</span>: {e.note}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <select value={evKind} onChange={(e) => setEvKind(e.target.value)} className="rounded border border-border/40 bg-background p-1.5 text-xs">
            <option value="investigation">investigation</option>
            <option value="containment">containment</option>
            <option value="notification">notification</option>
            <option value="remediation">remediation</option>
          </select>
          <input value={evNote} onChange={(e) => setEvNote(e.target.value)} placeholder="Notă..." className="flex-1 rounded border border-border/40 bg-background p-1.5 text-xs" />
          <button onClick={() => { if (evNote) { onAddEvent(evKind, evNote); setEvNote(""); } }}
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">+ Adaugă</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- DSA SoR ---------- */
function DsaSorTab() {
  const list = useServerFn(adminListDsaSor);
  const create = useServerFn(adminCreateDsaSor);
  const exp = useServerFn(adminExportDsaTransparency);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    action_type: "content_removed", target_user_id: "", target_content_type: "", target_content_id: "",
    legal_basis: "tos_violation", category: "", reasoning: "", automated: false,
  });
  const [report, setReport] = useState<any>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | "">(new Date().getMonth() + 1);

  const load = async () => {
    setLoading(true); setError(null);
    try { const r = await list(); setRows(r.rows); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.category || form.reasoning.length < 20) { toast.error("Categoria + reasoning ≥ 20 caractere"); return; }
    try {
      await create({ data: {
        action_type: form.action_type as any, legal_basis: form.legal_basis as any,
        category: form.category, reasoning: form.reasoning, automated: form.automated,
        target_user_id: form.target_user_id || null,
        target_content_type: form.target_content_type || null,
        target_content_id: form.target_content_id || null,
      } });
      toast.success("SoR creat"); setForm({ ...form, category: "", reasoning: "" });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doExport = async () => {
    try {
      const r = await exp({ data: { year, month: month === "" ? null : month } });
      setReport(r);
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Se încarcă…</div>;
  if (error) return <ErrorBox error={error} retry={load} />;

  return (
    <div className="space-y-4">
      <GlassCard>
        <p className="mb-3 text-sm font-medium">Creare Statement of Reasons (Art. 17 DSA)</p>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-xs">Acțiune
            <select value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm">
              <option value="content_removed">content_removed</option>
              <option value="content_demoted">content_demoted</option>
              <option value="account_suspended">account_suspended</option>
              <option value="account_banned">account_banned</option>
              <option value="account_restricted">account_restricted</option>
              <option value="feature_restricted">feature_restricted</option>
            </select>
          </label>
          <label className="text-xs">Legal basis
            <select value={form.legal_basis} onChange={(e) => setForm({ ...form, legal_basis: e.target.value })} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm">
              <option value="tos_violation">tos_violation</option>
              <option value="illegal_content_local">illegal_content_local</option>
              <option value="illegal_content_eu">illegal_content_eu</option>
              <option value="dsa_notice">dsa_notice</option>
              <option value="court_order">court_order</option>
              <option value="safety_measure">safety_measure</option>
            </select>
          </label>
          <label className="text-xs">Categorie (ex: hate_speech, csam, spam)
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
          </label>
          <label className="text-xs">Target user (UUID)
            <input value={form.target_user_id} onChange={(e) => setForm({ ...form, target_user_id: e.target.value })} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
          </label>
          <label className="text-xs">Content type
            <input value={form.target_content_type} onChange={(e) => setForm({ ...form, target_content_type: e.target.value })} placeholder="messages | profile | photo" className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
          </label>
          <label className="text-xs">Content ID
            <input value={form.target_content_id} onChange={(e) => setForm({ ...form, target_content_id: e.target.value })} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
          </label>
        </div>
        <label className="mt-3 block text-xs">Reasoning (motivare — DSA cere claritate)
          <textarea value={form.reasoning} onChange={(e) => setForm({ ...form, reasoning: e.target.value })} rows={3} className="mt-1 w-full rounded border border-border/40 bg-background p-2 text-sm" />
        </label>
        <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={form.automated} onChange={(e) => setForm({ ...form, automated: e.target.checked })} /> Decizie automată</label>
        <button onClick={submit} className="mt-3 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">Înregistrează SoR</button>
      </GlassCard>

      <GlassCard>
        <p className="mb-3 text-sm font-medium">Raport transparență (Art. 15/24 DSA)</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">An <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="ml-2 w-24 rounded border border-border/40 bg-background p-1.5 text-sm" /></label>
          <label className="text-xs">Lună (opt) <select value={month} onChange={(e) => setMonth(e.target.value === "" ? "" : parseInt(e.target.value))} className="ml-2 rounded border border-border/40 bg-background p-1.5 text-sm">
            <option value="">— tot anul —</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select></label>
          <button onClick={doExport} className="rounded border border-border/40 px-3 py-1.5 text-sm">Generează raport</button>
        </div>
        {report && (
          <div className="mt-3 text-xs">
            <p>Total acțiuni: <span className="font-mono">{report.total}</span></p>
            <div className="mt-2 space-y-1">
              {Object.entries(report.breakdown as Record<string, number>).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/20 py-1"><span className="font-mono">{k}</span><span className="font-mono">{v}</span></div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <p className="mb-3 text-sm font-medium">SoR-uri recente ({rows.length})</p>
        <div className="max-h-96 space-y-1.5 overflow-auto text-xs">
          {rows.map((r) => (
            <div key={r.id} className="rounded border border-border/40 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-primary/10 px-1.5 font-medium text-primary">{r.action_type}</span>
                <span className="rounded bg-muted px-1.5">{r.legal_basis}</span>
                <span className="rounded bg-muted px-1.5">{r.category}</span>
                {r.automated && <span className="rounded bg-amber-500/20 px-1.5 text-amber-300">AUTO</span>}
                <span className="ml-auto text-muted-foreground">{new Date(r.created_at).toLocaleString("ro-RO")}</span>
              </div>
              <p className="mt-1 text-muted-foreground line-clamp-2">{r.reasoning}</p>
            </div>
          ))}
          {rows.length === 0 && <p className="text-muted-foreground">Niciun SoR încă.</p>}
        </div>
      </GlassCard>
    </div>
  );
}

/* ---------- COUNTRY RISK ---------- */
function CountryTab() {
  const list = useServerFn(adminListCountryRisk);
  const upsert = useServerFn(adminUpsertCountryRisk);
  const del = useServerFn(adminDeleteCountryRisk);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<any | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { const r = await list(); setRows(r.rows); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const emptyRow = () => ({ country_code: "", country_name: "", risk_level: "elevated", hide_precise_location: true, force_stealth: true, disable_discover: false, disable_signup: false, reason: "" });

  if (loading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Se încarcă…</div>;
  if (error) return <ErrorBox error={error} retry={load} />;

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Politici country-risk ({rows.length})</p>
          <button onClick={() => setEdit(emptyRow())} className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground"><Plus className="size-3" />Adaugă țară</button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/40">
                <th className="p-1.5 text-left">Cod</th><th className="p-1.5 text-left">Țară</th><th className="p-1.5 text-left">Risc</th>
                <th className="p-1.5 text-center">Hide loc</th><th className="p-1.5 text-center">Stealth</th>
                <th className="p-1.5 text-center">No discover</th><th className="p-1.5 text-center">No signup</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.country_code} className="border-b border-border/20">
                  <td className="p-1.5 font-mono">{r.country_code}</td>
                  <td className="p-1.5">{r.country_name}</td>
                  <td className="p-1.5">
                    <span className={`rounded px-1.5 font-medium ${
                      r.risk_level === "blocked" ? "bg-red-500/30 text-red-200" :
                      r.risk_level === "high" ? "bg-orange-500/30 text-orange-200" :
                      r.risk_level === "elevated" ? "bg-amber-500/30 text-amber-200" :
                      "bg-emerald-500/20 text-emerald-300"}`}>{r.risk_level}</span>
                  </td>
                  <td className="p-1.5 text-center">{r.hide_precise_location ? "✓" : "—"}</td>
                  <td className="p-1.5 text-center">{r.force_stealth ? "✓" : "—"}</td>
                  <td className="p-1.5 text-center">{r.disable_discover ? "✓" : "—"}</td>
                  <td className="p-1.5 text-center">{r.disable_signup ? "✓" : "—"}</td>
                  <td className="p-1.5">
                    <button onClick={() => setEdit(r)} className="mr-1 text-primary hover:underline">Edit</button>
                    <button onClick={async () => {
                      if (!confirm(`Șterge ${r.country_code}?`)) return;
                      try { await del({ data: { country_code: r.country_code } }); toast.success("Șters"); load(); }
                      catch (e: any) { toast.error(e.message); }
                    }} className="text-red-400 hover:underline"><Trash2 className="inline size-3" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {edit && (
        <GlassCard>
          <p className="mb-3 text-sm font-medium">{edit.country_code ? `Editează ${edit.country_code}` : "Adaugă țară"}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs">Cod ISO-2
              <input value={edit.country_code} onChange={(e) => setEdit({ ...edit, country_code: e.target.value.toUpperCase() })} maxLength={2} className="mt-1 w-full rounded border border-border/40 bg-background p-2 uppercase" />
            </label>
            <label className="text-xs">Nume țară
              <input value={edit.country_name} onChange={(e) => setEdit({ ...edit, country_name: e.target.value })} className="mt-1 w-full rounded border border-border/40 bg-background p-2" />
            </label>
            <label className="text-xs">Nivel risc
              <select value={edit.risk_level} onChange={(e) => setEdit({ ...edit, risk_level: e.target.value })} className="mt-1 w-full rounded border border-border/40 bg-background p-2">
                <option value="normal">normal</option><option value="elevated">elevated</option><option value="high">high</option><option value="blocked">blocked</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={edit.hide_precise_location} onChange={(e) => setEdit({ ...edit, hide_precise_location: e.target.checked })} /> Ascunde locație precisă</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={edit.force_stealth} onChange={(e) => setEdit({ ...edit, force_stealth: e.target.checked })} /> Forțează stealth</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={edit.disable_discover} onChange={(e) => setEdit({ ...edit, disable_discover: e.target.checked })} /> Dezactivează Discover</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={edit.disable_signup} onChange={(e) => setEdit({ ...edit, disable_signup: e.target.checked })} /> Blochează signup</label>
            <label className="text-xs md:col-span-3">Motiv
              <input value={edit.reason ?? ""} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} className="mt-1 w-full rounded border border-border/40 bg-background p-2" />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={async () => {
              try {
                await upsert({ data: edit });
                toast.success("Salvat"); setEdit(null); load();
              } catch (e: any) { toast.error(e.message); }
            }} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">Salvează</button>
            <button onClick={() => setEdit(null)} className="rounded border border-border/40 px-3 py-1.5 text-sm">Anulează</button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

/* ---------- E-FACTURA ---------- */
function EfacturaTab() {
  const list = useServerFn(adminListEfacturaQueue);
  const gen = useServerFn(adminGenerateEfacturaXml);
  const mark = useServerFn(adminMarkEfacturaSubmitted);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<Record<string, string>>({});
  const [xml, setXml] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true); setError(null);
    try { const r = await list(); setRows(r.rows); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const downloadXml = (invoiceLabel: string, content: string) => {
    const blob = new Blob([content], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${invoiceLabel}.xml`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Se încarcă…</div>;
  if (error) return <ErrorBox error={error} retry={load} />;

  return (
    <div className="space-y-3">
      <GlassCard>
        <p className="text-sm font-medium">Coadă e-Factura ANAF ({rows.length})</p>
        <p className="mt-1 text-xs text-muted-foreground">Generăm UBL 2.1 (CIUS-RO). Upload la SPV se face manual sau prin OAuth ANAF (necesită certificat digital calificat + acces SPV).</p>
      </GlassCard>
      <div className="space-y-2">
        {rows.map((r) => {
          const inv = r.partner_invoices;
          const label = `${inv?.series}${String(inv?.number ?? 0).padStart(6, "0")}`;
          return (
            <GlassCard key={r.id}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-semibold">{label}</span>
                <span className="text-muted-foreground">·</span>
                <span>{((inv?.total_minor ?? 0) / 100).toFixed(2)} {inv?.currency}</span>
                <span className="text-muted-foreground">· plată: {inv?.status}</span>
                <span className={`ml-auto rounded px-1.5 font-medium ${
                  r.status === "accepted" ? "bg-emerald-500/20 text-emerald-300" :
                  r.status === "rejected" ? "bg-red-500/20 text-red-300" :
                  r.status === "submitted" ? "bg-blue-500/20 text-blue-300" :
                  r.status === "generated" ? "bg-amber-500/20 text-amber-300" :
                  "bg-muted"}`}>{r.status}</span>
                {r.anaf_upload_id && <span className="font-mono">ANAF: {r.anaf_upload_id}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={async () => {
                  try { const res = await gen({ data: { queueId: r.id } }); setXml({ ...xml, [r.id]: res.xml }); toast.success("XML generat"); load(); }
                  catch (e: any) { toast.error(e.message); }
                }} className="rounded border border-border/40 px-2 py-1 text-xs">1. Generează XML</button>
                {xml[r.id] && (
                  <button onClick={() => downloadXml(label, xml[r.id])} className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                    <Download className="size-3" />2. Descarcă .xml
                  </button>
                )}
                <input placeholder="ANAF upload ID" value={uploadId[r.id] ?? ""} onChange={(e) => setUploadId({ ...uploadId, [r.id]: e.target.value })}
                  className="flex-1 min-w-[120px] rounded border border-border/40 bg-background p-1 text-xs" />
                <button onClick={async () => {
                  if (!uploadId[r.id]) return;
                  try { await mark({ data: { queueId: r.id, anafUploadId: uploadId[r.id], status: "submitted" } }); toast.success("Submitted"); load(); }
                  catch (e: any) { toast.error(e.message); }
                }} className="rounded bg-blue-600 px-2 py-1 text-xs text-white">3. Submitted</button>
                <button onClick={async () => {
                  if (!uploadId[r.id]) return;
                  try { await mark({ data: { queueId: r.id, anafUploadId: uploadId[r.id], status: "accepted" } }); toast.success("Accepted"); load(); }
                  catch (e: any) { toast.error(e.message); }
                }} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">4. Accepted</button>
              </div>
              {xml[r.id] && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Vezi XML</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-background/50 p-2 font-mono text-[10px]">{xml[r.id]}</pre>
                </details>
              )}
            </GlassCard>
          );
        })}
        {rows.length === 0 && <p className="text-xs text-muted-foreground">Nicio factură în coadă.</p>}
      </div>
    </div>
  );
}
