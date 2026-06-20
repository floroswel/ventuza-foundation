import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Ban, Check, X } from "lucide-react";

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

function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isMod, setIsMod] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const ok = roles?.some((r) => r.role === "admin" || r.role === "moderator") ?? false;
      setIsMod(ok);
      if (ok) loadReports();
    })();
  }, [user, loading]);

  async function loadReports() {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); return; }
    const ids = Array.from(new Set((data ?? []).map((r) => r.reported_id)));
    const profilesMap = new Map<string, { display_name: string | null; report_count: number; suspended_until: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, report_count, suspended_until")
        .in("id", ids);
      profs?.forEach((p) => profilesMap.set(p.id, { display_name: p.display_name, report_count: p.report_count ?? 0, suspended_until: p.suspended_until }));
    }
    setReports((data ?? []).map((r) => ({ ...r, reported_profile: profilesMap.get(r.reported_id) ?? null })) as Report[]);
  }

  async function suspend(userId: string, hours: number, reason: string) {
    setBusy(true);
    const { error } = await supabase.rpc("moderator_suspend_user", { _target: userId, _hours: hours, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(hours > 0 ? `Suspendat ${hours}h` : "Suspendare anulată");
    loadReports();
  }

  async function resolve(reportId: string, dismissed = false) {
    setBusy(true);
    const { error } = await supabase
      .from("reports")
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
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Moderation Queue</h1>
        <p className="text-sm text-muted-foreground">{reports.length} rapoarte deschise</p>
      </header>

      {reports.length === 0 ? (
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
                      <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-500">
                        {r.reported_profile.report_count} rapoarte
                      </span>
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
                <button disabled={busy} onClick={() => suspend(r.reported_id, 24, r.reason)} className="rounded-full bg-orange-500/15 px-3 py-1.5 text-xs font-medium text-orange-500 hover:bg-orange-500/25 disabled:opacity-50">
                  <Ban className="mr-1 inline size-3" /> Suspend 24h
                </button>
                <button disabled={busy} onClick={() => suspend(r.reported_id, 24 * 7, r.reason)} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/25 disabled:opacity-50">
                  <Ban className="mr-1 inline size-3" /> Suspend 7 zile
                </button>
                <button disabled={busy} onClick={() => resolve(r.id, false)} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50">
                  <Check className="mr-1 inline size-3" /> Rezolvat
                </button>
                <button disabled={busy} onClick={() => resolve(r.id, true)} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50">
                  <X className="mr-1 inline size-3" /> Respinge
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
