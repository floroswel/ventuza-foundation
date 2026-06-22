import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Ban, Check, X, AlertTriangle, ShieldCheck, BadgeCheck, Megaphone, Play, Pause, Building2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Moderation — Ventuza" }, { name: "robots", content: "noindex" }] }),
  component: AdminDashboard,
});

type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reported_profile?: { display_name: string | null; report_count: number; suspended_until: string | null } | null;
};

type RiskRow = {
  user_id: string;
  display_name: string | null;
  risk_score: number;
  risk_signals: Record<string, unknown>;
  verified: boolean;
  report_count: number;
  suspended_until: string | null;
  banned_at: string | null;
  open_flags: number;
  duplicate_photo_accounts: number;
  recent_flag_kinds: string[];
  last_flag_at: string | null;
};

function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isMod, setIsMod] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"reports" | "risk" | "ads" | "biz">("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [risk, setRisk] = useState<RiskRow[]>([]);
  const [ads, setAds] = useState<Array<{ id: string; title: string; body: string | null; placement: string; status: string; city: string | null; cta_url: string | null; image_url: string | null; starts_at: string; ends_at: string; budget_cents: number; impressions: number; clicks: number; advertiser_id: string; brand_name?: string | null }>>([]);
  const [bizApps, setBizApps] = useState<Array<{ id: string; entity_type: string; legal_name: string; brand_name: string | null; cui: string | null; contact_name: string; contact_email: string; contact_phone: string | null; website: string | null; city: string | null; category: string | null; goals: string; monthly_budget_eur: number | null; status: string; user_id: string | null; created_at: string }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const ok = roles?.some((r) => r.role === "admin" || r.role === "moderator") ?? false;
      setIsMod(ok);
      if (ok) { loadReports(); loadRisk(); loadAds(); loadBiz(); }
    })();
  }, [user, loading]);

  async function loadReports() {
    const { data, error } = await supabase
      .from("reports").select("*").eq("status", "pending")
      .order("created_at", { ascending: false }).limit(100);
    if (error) { toast.error(error.message); return; }
    const ids = Array.from(new Set((data ?? []).map((r) => r.reported_id)));
    const profilesMap = new Map<string, { display_name: string | null; report_count: number; suspended_until: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("id, display_name, report_count, suspended_until").in("id", ids);
      profs?.forEach((p) => profilesMap.set(p.id, { display_name: p.display_name, report_count: p.report_count ?? 0, suspended_until: p.suspended_until }));
    }
    setReports((data ?? []).map((r) => ({ ...r, reported_profile: profilesMap.get(r.reported_id) ?? null })) as Report[]);
  }

  async function loadRisk() {
    const { data, error } = await supabase.rpc("admin_risk_queue", { _limit: 100 });
    if (error) { toast.error(error.message); return; }
    setRisk((data ?? []) as RiskRow[]);
  }

  async function loadAds() {
    const { data, error } = await supabase
      .from("ad_campaigns")
      .select("id, title, body, placement, status, city, cta_url, image_url, starts_at, ends_at, budget_cents, impressions, clicks, advertiser_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { toast.error(error.message); return; }
    const advIds = Array.from(new Set((data ?? []).map((c) => c.advertiser_id)));
    const brandMap = new Map<string, string>();
    if (advIds.length) {
      const { data: advs } = await supabase.from("advertisers").select("id, brand_name").in("id", advIds);
      advs?.forEach((a) => brandMap.set(a.id, a.brand_name));
    }
    setAds((data ?? []).map((c) => ({ ...c, brand_name: brandMap.get(c.advertiser_id) ?? null })));
  }

  async function setAdStatus(id: string, status: string) {
    setBusy(true);
    const { error } = await supabase.from("ad_campaigns").update({ status }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Status: ${status}`);
    loadAds();
  }

  async function loadBiz() {
    const { data, error } = await supabase
      .from("business_applications")
      .select("id, entity_type, legal_name, brand_name, cui, contact_name, contact_email, contact_phone, website, city, category, goals, monthly_budget_eur, status, user_id, created_at")
      .in("status", ["pending", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { toast.error(error.message); return; }
    setBizApps((data ?? []) as typeof bizApps);
  }

  async function setBizStatus(id: string, status: "approved" | "rejected" | "reviewing") {
    setBusy(true);
    const { error } = await supabase.from("business_applications").update({ status }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Aprobat — rol business acordat" : `Status: ${status}`);
    loadBiz();
  }

  async function suspend(userId: string, hours: number, reason: string) {
    setBusy(true);
    const { error } = await supabase.rpc("moderator_suspend_user", { _target: userId, _hours: hours, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(hours > 0 ? `Suspendat ${hours}h` : "Suspendare anulată");
    loadReports(); loadRisk();
  }

  async function verifyUser(userId: string) {
    setBusy(true);
    const { error } = await supabase.rpc("moderator_verify_user", { _target: userId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Verificat");
    loadRisk();
  }

  async function warnUser(userId: string) {
    const reason = prompt("Motiv avertisment:");
    if (!reason) return;
    setBusy(true);
    const { error } = await supabase.rpc("moderator_warn_user", { _target: userId, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Utilizator avertizat");
    loadRisk();
  }

  async function banUser(userId: string) {
    const reason = prompt("Motiv ban permanent:");
    if (!reason) return;
    if (!confirm("Ban permanent? Acțiunea va suspenda contul pe termen lung.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("moderator_ban_user", { _target: userId, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Cont banat");
    loadRisk(); loadReports();
  }

  async function resolve(reportId: string, dismissed = false) {
    setBusy(true);
    const { error } = await supabase.from("reports")
      .update({ status: dismissed ? "dismissed" : "resolved", resolved_at: new Date().toISOString(), resolved_by: user!.id })
      .eq("id", reportId);
    setBusy(false);
    if (error) return toast.error(error.message);
    setReports((r) => r.filter((x) => x.id !== reportId));
  }

  if (loading || isMod === null) {
    return <div className="flex min-h-dvh items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  }
  if (!isMod) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <ShieldAlert className="mx-auto size-12 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Acces interzis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Doar moderatorii și administratorii pot vedea această pagină.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Moderation</h1>
        <div className="mt-3 flex gap-2 text-xs">
          <button onClick={() => setTab("reports")}
            className={`rounded-full px-4 py-1.5 font-medium ${tab === "reports" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
            Rapoarte ({reports.length})
          </button>
          <button onClick={() => setTab("risk")}
            className={`rounded-full px-4 py-1.5 font-medium ${tab === "risk" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
            Risc & Catfishing ({risk.length})
          </button>
          <button onClick={() => setTab("ads")}
            className={`rounded-full px-4 py-1.5 font-medium ${tab === "ads" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
            <Megaphone className="mr-1 inline size-3" /> Ads ({ads.filter(a => a.status === "pending").length})
          </button>
          <button onClick={() => setTab("biz")}
            className={`rounded-full px-4 py-1.5 font-medium ${tab === "biz" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
            <Building2 className="mr-1 inline size-3" /> B2B ({bizApps.length})
          </button>
        </div>
      </header>

      {tab === "reports" && (reports.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          🎉 Nimic de moderat acum
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">{r.reason}</span>
                    {r.reported_profile?.report_count && r.reported_profile.report_count >= 3 && (
                      <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-500">{r.reported_profile.report_count} rapoarte</span>
                    )}
                    {r.reported_profile?.suspended_until && new Date(r.reported_profile.suspended_until) > new Date() && (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-500">Suspendat</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium">{r.reported_profile?.display_name ?? r.reported_id.slice(0, 8)}</p>
                  {r.details && <p className="mt-1 text-xs text-muted-foreground">{r.details}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ro-RO")}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => suspend(r.reported_id, 24, r.reason)} className="rounded-full bg-orange-500/15 px-3 py-1.5 text-xs font-medium text-orange-500 hover:bg-orange-500/25 disabled:opacity-50"><Ban className="mr-1 inline size-3" /> Suspend 24h</button>
                <button disabled={busy} onClick={() => suspend(r.reported_id, 24 * 7, r.reason)} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/25 disabled:opacity-50"><Ban className="mr-1 inline size-3" /> Suspend 7 zile</button>
                <button disabled={busy} onClick={() => banUser(r.reported_id)} className="rounded-full bg-red-700/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-700/30 disabled:opacity-50"><Ban className="mr-1 inline size-3" /> Ban</button>
                <button disabled={busy} onClick={() => resolve(r.id, false)} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50"><Check className="mr-1 inline size-3" /> Rezolvat</button>
                <button disabled={busy} onClick={() => resolve(r.id, true)} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50"><X className="mr-1 inline size-3" /> Respinge</button>
              </div>
            </li>
          ))}
        </ul>
      ))}

      {tab === "risk" && (risk.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          ✅ Niciun cont cu risc detectat
        </div>
      ) : (
        <ul className="space-y-3">
          {risk.map((r) => {
            const scoreColor = r.risk_score >= 80 ? "text-red-500 bg-red-500/15" : r.risk_score >= 60 ? "text-orange-500 bg-orange-500/15" : "text-yellow-500 bg-yellow-500/10";
            return (
              <li key={r.user_id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${scoreColor}`}>Risc {r.risk_score}</span>
                      {r.verified && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary"><BadgeCheck className="mr-0.5 inline size-3" />Verificat</span>}
                      {r.duplicate_photo_accounts > 0 && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-500"><AlertTriangle className="mr-0.5 inline size-3" />Poză duplicat × {r.duplicate_photo_accounts}</span>
                      )}
                      {r.report_count > 0 && <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-500">{r.report_count} rapoarte</span>}
                      {r.banned_at && <span className="rounded-full bg-red-700/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">Banat</span>}
                      {r.suspended_until && new Date(r.suspended_until) > new Date() && !r.banned_at && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-500">Suspendat</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium">{r.display_name ?? r.user_id.slice(0, 8)}</p>
                    {r.recent_flag_kinds.length > 0 && (
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Semnale: {r.recent_flag_kinds.join(" · ")}
                      </p>
                    )}
                    {Object.keys(r.risk_signals || {}).length > 0 && (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-background/60 p-2 text-[10px] text-muted-foreground">
                        {JSON.stringify(r.risk_signals, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => verifyUser(r.user_id)} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50"><ShieldCheck className="mr-1 inline size-3" /> Verifică</button>
                  <button disabled={busy} onClick={() => warnUser(r.user_id)} className="rounded-full bg-yellow-500/15 px-3 py-1.5 text-xs font-medium text-yellow-500 hover:bg-yellow-500/25 disabled:opacity-50"><AlertTriangle className="mr-1 inline size-3" /> Avertizează</button>
                  <button disabled={busy} onClick={() => suspend(r.user_id, 24, "high risk")} className="rounded-full bg-orange-500/15 px-3 py-1.5 text-xs font-medium text-orange-500 hover:bg-orange-500/25 disabled:opacity-50"><Ban className="mr-1 inline size-3" /> Suspend 24h</button>
                  <button disabled={busy} onClick={() => suspend(r.user_id, 24 * 7, "high risk")} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/25 disabled:opacity-50"><Ban className="mr-1 inline size-3" /> Suspend 7 zile</button>
                  <button disabled={busy} onClick={() => banUser(r.user_id)} className="rounded-full bg-red-700/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-700/30 disabled:opacity-50"><Ban className="mr-1 inline size-3" /> Ban</button>
                </div>
              </li>
            );
          })}
        </ul>
      ))}

      {tab === "ads" && (ads.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Nicio campanie încă.
        </div>
      ) : (
        <ul className="space-y-3">
          {ads.map((a) => {
            const isActive = a.status === "active";
            const isPending = a.status === "pending";
            const statusColor = isActive ? "bg-green-500/15 text-green-500" : isPending ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground";
            return (
              <li key={a.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor}`}>{a.status}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{a.placement.replace("_", " ")}</span>
                      {a.city && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{a.city}</span>}
                    </div>
                    <p className="mt-2 text-sm font-medium">{a.title}</p>
                    <p className="text-[10px] text-muted-foreground">{a.brand_name ?? a.advertiser_id.slice(0, 8)} · {a.budget_cents / 100} RON · {a.impressions} impresii · {a.clicks} click-uri</p>
                    {a.body && <p className="mt-1 text-xs text-muted-foreground">{a.body}</p>}
                    {a.cta_url && <a href={a.cta_url} target="_blank" rel="noopener" className="mt-1 inline-block break-all text-[10px] text-primary">{a.cta_url}</a>}
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(a.starts_at).toLocaleDateString("ro-RO")} → {new Date(a.ends_at).toLocaleDateString("ro-RO")}</p>
                  </div>
                  {a.image_url && <img src={a.image_url} alt="" className="size-16 rounded-lg object-cover" />}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!isActive && <button disabled={busy} onClick={() => setAdStatus(a.id, "active")} className="rounded-full bg-green-500/15 px-3 py-1.5 text-xs font-medium text-green-500 hover:bg-green-500/25 disabled:opacity-50"><Play className="mr-1 inline size-3" /> Activează</button>}
                  {isActive && <button disabled={busy} onClick={() => setAdStatus(a.id, "paused")} className="rounded-full bg-yellow-500/15 px-3 py-1.5 text-xs font-medium text-yellow-500 hover:bg-yellow-500/25 disabled:opacity-50"><Pause className="mr-1 inline size-3" /> Pauză</button>}
                  <button disabled={busy} onClick={() => setAdStatus(a.id, "rejected")} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/25 disabled:opacity-50"><X className="mr-1 inline size-3" /> Respinge</button>
                  <button disabled={busy} onClick={() => setAdStatus(a.id, "ended")} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50">Termină</button>
                </div>
              </li>
            );
          })}
        </ul>
      ))}
    </main>

  );
}
