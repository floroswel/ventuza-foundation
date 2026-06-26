/**
 * Admin panel: Partners + Moderation queue + Offer stats.
 *
 * Three sub-tabs:
 *   1. Aplicații parteneri  — review business_applications, approve/reject.
 *   2. Parteneri              — list partner role holders, suspend/reinstate (cascade-hides content).
 *   3. Coadă moderare         — venues/events/offers awaiting approval, with full detail view.
 *
 * Owner cannot self-publish (RLS + DB trigger). Approval here is the only path
 * to nearby visibility. All mutations are audit-logged server-side.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, ShieldCheck, ListChecks, Check, X, Pause, Play, RefreshCw, MapPin, Calendar, Tag, AlertTriangle, Crown } from "lucide-react";
import {
  adminListBusinessApplications, adminDecideBusinessApplication,
  adminListPartners, adminSuspendPartner, adminReinstatePartner,
  adminListModerationQueue, adminGetModerationItem, adminModerateItem,
  adminOfferStats,
} from "@/lib/admin-partners.functions";

type Tab = "apps" | "partners" | "queue";

export function PartnersModerationPanel({ canAdmin }: { canAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>("queue");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border pb-2">
        <TabBtn active={tab === "queue"} onClick={() => setTab("queue")} icon={ListChecks} label="Coadă moderare" />
        <TabBtn active={tab === "apps"} onClick={() => setTab("apps")} icon={Building2} label="Aplicații parteneri" />
        <TabBtn active={tab === "partners"} onClick={() => setTab("partners")} icon={ShieldCheck} label="Parteneri" />
      </div>
      {tab === "queue" && <ModerationQueue />}
      {tab === "apps" && <BusinessApps canAdmin={canAdmin} />}
      {tab === "partners" && <PartnersList canAdmin={canAdmin} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface"
      }`}>
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

/* --------------------------------- APPS ---------------------------------- */
function BusinessApps({ canAdmin }: { canAdmin: boolean }) {
  const list = useServerFn(adminListBusinessApplications);
  const decide = useServerFn(adminDecideBusinessApplication);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { setRows(await list({ data: { status, limit: 100 } })); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const act = async (id: string, decision: "approved" | "rejected") => {
    const notes = decision === "rejected" ? (prompt("Motivul respingerii (vizibil intern):") ?? "") : "";
    if (decision === "rejected" && !notes) return;
    try { await decide({ data: { id, decision, notes } }); toast.success("Actualizat"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
          <option value="pending">În așteptare</option>
          <option value="approved">Aprobate</option>
          <option value="rejected">Respinse</option>
          <option value="all">Toate</option>
        </select>
        <button onClick={load} className="rounded-md border border-border px-2 py-1 text-xs"><RefreshCw className="size-3" /></button>
      </div>
      {busy ? <p className="text-xs text-muted-foreground">Se încarcă…</p> :
        rows.length === 0 ? <p className="text-xs text-muted-foreground">Nicio aplicație.</p> :
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-surface p-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.business_name} <span className="ml-1 text-muted-foreground">· {r.business_type}</span></p>
                  <p className="text-muted-foreground">{r.contact_name} · {r.contact_email}{r.contact_phone ? ` · ${r.contact_phone}` : ""}</p>
                  <p className="mt-1 text-muted-foreground">Status: <b>{r.status}</b> · creată {new Date(r.created_at).toLocaleString()}</p>
                  {r.review_notes && <p className="mt-1 italic text-muted-foreground">„{r.review_notes}"</p>}
                </div>
                {canAdmin && r.status === "pending" && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => act(r.id, "approved")} className="rounded-md bg-green-600 px-2 py-1 text-white"><Check className="size-3.5" /></button>
                    <button onClick={() => act(r.id, "rejected")} className="rounded-md bg-red-600 px-2 py-1 text-white"><X className="size-3.5" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>}
    </div>
  );
}

/* ------------------------------- PARTNERS -------------------------------- */
function PartnersList({ canAdmin }: { canAdmin: boolean }) {
  const list = useServerFn(adminListPartners);
  const suspend = useServerFn(adminSuspendPartner);
  const reinstate = useServerFn(adminReinstatePartner);
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { setRows(await list({ data: { filter, search: search || undefined, limit: 100 } })); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const onSuspend = async (id: string) => {
    const reason = prompt("Motiv suspendare partener (vizibil intern, conținutul se ascunde instant):");
    if (!reason) return;
    try { await suspend({ data: { user_id: id, reason } }); toast.success("Suspendat — venues/oferte ascunse"); load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const onReinstate = async (id: string) => {
    if (!confirm("Reactivezi partenerul? Conținutul lui APROBAT redevine vizibil.")) return;
    try { await reinstate({ data: { user_id: id } }); toast.success("Reactivat"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
          <option value="all">Toți</option>
          <option value="active">Activi</option>
          <option value="suspended">Suspendați</option>
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută nume…"
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs" />
        <button onClick={load} className="rounded-md border border-border px-2 py-1 text-xs"><RefreshCw className="size-3" /></button>
      </div>
      {busy ? <p className="text-xs text-muted-foreground">Se încarcă…</p> :
        rows.length === 0 ? <p className="text-xs text-muted-foreground">Niciun partener.</p> :
        <div className="space-y-2">
          {rows.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-surface p-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold flex items-center gap-2">
                    {p.display_name || "(fără nume)"}
                    {p.partner_suspended_at ? (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">SUSPENDAT</span>
                    ) : (
                      <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-300">ACTIV</span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    Venues: <b>{p.stats.venues}</b> ({p.stats.published} publicate) · Oferte: <b>{p.stats.offers}</b>
                  </p>
                  {p.partner_suspension_reason && (
                    <p className="mt-1 italic text-red-300">„{p.partner_suspension_reason}"</p>
                  )}
                </div>
                {canAdmin && (
                  <div className="flex gap-1 shrink-0">
                    {p.partner_suspended_at ? (
                      <button onClick={() => onReinstate(p.id)} className="rounded-md bg-green-600 px-2 py-1 text-white"><Play className="size-3.5" /></button>
                    ) : (
                      <button onClick={() => onSuspend(p.id)} className="rounded-md bg-red-600 px-2 py-1 text-white"><Pause className="size-3.5" /></button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>}
    </div>
  );
}

/* -------------------------------- QUEUE ---------------------------------- */
function ModerationQueue() {
  const list = useServerFn(adminListModerationQueue);
  const [kind, setKind] = useState<"all" | "venue" | "event" | "offer">("all");
  const [status, setStatus] = useState<"pending" | "changes_requested" | "rejected" | "approved" | "all">("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<{ kind: "venue" | "event" | "offer"; id: string } | null>(null);

  const load = async () => {
    setBusy(true);
    try { setRows(await list({ data: { kind, status, limit: 150 } })); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kind, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as any)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
          <option value="all">Toate</option>
          <option value="venue">Venues</option>
          <option value="event">Evenimente</option>
          <option value="offer">Oferte</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
          <option value="pending">În așteptare</option>
          <option value="changes_requested">Modificări cerute</option>
          <option value="rejected">Respinse</option>
          <option value="approved">Aprobate</option>
          <option value="all">Toate</option>
        </select>
        <button onClick={load} className="rounded-md border border-border px-2 py-1 text-xs"><RefreshCw className="size-3" /></button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          ⚠ Verifică text+imagini pentru abuz/escort/spam ÎNAINTE de aprobare.
        </span>
      </div>

      {busy ? <p className="text-xs text-muted-foreground">Se încarcă…</p> :
        rows.length === 0 ? <p className="text-xs text-muted-foreground">Coadă goală.</p> :
        <div className="space-y-2">
          {rows.map((r) => {
            const Icon = r.kind === "venue" ? MapPin : r.kind === "event" ? Calendar : Tag;
            return (
              <button key={`${r.kind}:${r.id}`} onClick={() => setOpen({ kind: r.kind, id: r.id })}
                className="block w-full rounded-lg border border-border bg-surface p-3 text-left text-xs hover:border-primary">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <p className="truncate font-semibold">{r.title || "(fără titlu)"}</p>
                    {r.is_official && <Crown className="size-3 text-yellow-400" />}
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                    r.moderation_status === "pending" ? "bg-yellow-500/20 text-yellow-300" :
                    r.moderation_status === "approved" ? "bg-green-500/20 text-green-300" :
                    r.moderation_status === "rejected" ? "bg-red-500/20 text-red-300" :
                    "bg-blue-500/20 text-blue-300"
                  }`}>{r.moderation_status}</span>
                </div>
                <p className="mt-1 text-muted-foreground truncate">
                  {r.kind} · {new Date(r.created_at).toLocaleString()}
                </p>
              </button>
            );
          })}
        </div>}

      {open && <ModerationDetail item={open} onClose={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function ModerationDetail({ item, onClose }: { item: { kind: "venue" | "event" | "offer"; id: string }; onClose: () => void }) {
  const get = useServerFn(adminGetModerationItem);
  const moderate = useServerFn(adminModerateItem);
  const offerStats = useServerFn(adminOfferStats);
  const [data, setData] = useState<any>(null);
  const [stats, setStats] = useState<{ total: number; redeemed: number } | null>(null);
  const [radius, setRadius] = useState<number>(2000);
  const [isOfficial, setIsOfficial] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const row = await get({ data: item });
        setData(row);
        setRadius(row?.notification_radius_m ?? 2000);
        setIsOfficial(!!row?.is_official);
        if (item.kind === "offer") setStats(await offerStats({ data: { offer_id: item.id } }));
      } catch (e: any) { toast.error(e.message); }
    })();
  }, [item.id]);

  const act = async (decision: "approved" | "rejected" | "changes_requested") => {
    const reason = decision === "approved" ? undefined : (prompt(`Motiv (${decision}):`) ?? undefined);
    if (decision !== "approved" && !reason) return;
    setBusy(true);
    try {
      await moderate({ data: {
        ...item, decision, reason,
        notification_radius_m: item.kind !== "offer" ? radius : undefined,
        is_official: item.kind !== "offer" ? isOfficial : undefined,
      } });
      toast.success(decision === "approved" ? "Publicat în nearby" : "Trimis înapoi");
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-xl bg-background p-5" onClick={(e) => e.stopPropagation()}>
        {!data ? <p className="text-sm text-muted-foreground">Se încarcă…</p> : (
          <div className="space-y-4 text-sm">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.kind} · {data.moderation_status}</p>
                <h2 className="text-lg font-semibold">{data.title || data.name}</h2>
              </div>
              <button onClick={onClose} className="rounded-md border border-border px-2 py-1 text-xs">Închide</button>
            </header>

            {data.description && <p className="whitespace-pre-wrap text-muted-foreground">{data.description}</p>}

            {(data.cover_url || data.image_url) && (
              <img src={data.cover_url || data.image_url} alt="" className="max-h-64 w-full rounded-md object-cover" />
            )}

            <dl className="grid grid-cols-2 gap-2 text-xs">
              {data.starts_at && <Field k="Început" v={new Date(data.starts_at).toLocaleString()} />}
              {data.ends_at && <Field k="Sfârșit" v={new Date(data.ends_at).toLocaleString()} />}
              {data.valid_from && <Field k="Valabil de la" v={new Date(data.valid_from).toLocaleString()} />}
              {data.valid_until && <Field k="Valabil până la" v={new Date(data.valid_until).toLocaleString()} />}
              {data.address && <Field k="Adresă" v={data.address} />}
              {data.category && <Field k="Categorie" v={data.category} />}
              {data.terms && <Field k="Termeni" v={data.terms} />}
              {data.geo_bucket_id && <Field k="Bucket" v={data.geo_bucket_id} />}
              {data.rejection_reason && <Field k="Motiv anterior" v={data.rejection_reason} />}
            </dl>

            {item.kind === "offer" && stats && (
              <p className="rounded-md bg-surface px-3 py-2 text-xs">
                Revendicări: <b>{stats.total}</b> · răscumpărate: <b>{stats.redeemed}</b> (fără identități utilizatori)
              </p>
            )}

            {item.kind !== "offer" && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <label className="block text-xs">
                  Rază notificare: <b>{(radius / 1000).toFixed(1)} km</b>
                  <input type="range" min={500} max={10000} step={250} value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))} className="mt-1 w-full" />
                  <span className="text-[10px] text-muted-foreground">Limitat anti-spam (max 10km, throttle notificări per partener).</span>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={isOfficial} onChange={(e) => setIsOfficial(e.target.checked)} />
                  <span>Marchează ca <b>oficial Ventuza</b> (declanșează <i>priority_access</i> pentru Fondatori).</span>
                </label>
              </div>
            )}

            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-2 text-[11px] text-yellow-300/80">
              <AlertTriangle className="mr-1 inline size-3" />
              Verifică text și imagini pentru: escort/sex-work, conținut violent, minori, discurs incitator, spam.
              Aprobarea este singura poartă spre nearby — owner-ul NU poate publica singur.
            </div>

            <footer className="flex flex-wrap gap-2 border-t border-border pt-3">
              <button disabled={busy} onClick={() => act("approved")} className="rounded-md bg-green-600 px-3 py-1.5 text-xs text-white">Aprobă</button>
              <button disabled={busy} onClick={() => act("changes_requested")} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white">Cere modificări</button>
              <button disabled={busy} onClick={() => act("rejected")} className="rounded-md bg-red-600 px-3 py-1.5 text-xs text-white">Respinge</button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded bg-surface px-2 py-1">
      <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
      <p className="truncate">{v}</p>
    </div>
  );
}
