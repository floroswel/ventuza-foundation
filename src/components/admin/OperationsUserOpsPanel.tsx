import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, LogOut, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard, SectionTitle, StatusBadge } from "@/components/admin/ui/primitives";
import { ReasonDialog } from "@/components/admin/ReasonDialog";
import {
  startImpersonation, endImpersonation, adminListImpersonations,
} from "@/lib/admin-impersonation.functions";
import {
  adminGetUserAuth, adminRevokeUserSessions, adminRevokePushSub,
} from "@/lib/admin-sessions.functions";

export function OperationsUserOpsPanel() {
  const [tab, setTab] = useState<"impersonate" | "auditlog">("impersonate");
  return (
    <div className="space-y-4">
      <SectionTitle>Operațiuni utilizator (view-as, sesiuni, dispozitive)</SectionTitle>
      <div className="flex gap-2">
        <button onClick={() => setTab("impersonate")}
          className={`rounded-full px-3 py-1 text-xs ${tab === "impersonate" ? "bg-primary text-primary-foreground" : "border border-border"}`}>
          View-as / Sesiuni
        </button>
        <button onClick={() => setTab("auditlog")}
          className={`rounded-full px-3 py-1 text-xs ${tab === "auditlog" ? "bg-primary text-primary-foreground" : "border border-border"}`}>
          Audit view-as (auditor)
        </button>
      </div>
      {tab === "impersonate" ? <ImpersonateBlock /> : <ImpersonationLogBlock />}
    </div>
  );
}

function ImpersonateBlock() {
  const start = useServerFn(startImpersonation);
  const end = useServerFn(endImpersonation);
  const getAuth = useServerFn(adminGetUserAuth);
  const revokeAll = useServerFn(adminRevokeUserSessions);
  const revokeSub = useServerFn(adminRevokePushSub);
  const [uid, setUid] = useState("");
  const [dossier, setDossier] = useState<any>(null);
  const [authInfo, setAuthInfo] = useState<any>(null);
  const [impId, setImpId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div>
            <Label className="text-xs">User ID (UUID)</Label>
            <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="00000000-…" className="mt-1" />
          </div>
          <div className="flex items-end">
            <ReasonDialog
              title="Start view-as (impersonare read-only)"
              description="Se logă în admin_impersonation_log ȘI admin_audit_log (severity: critical). Nu se preiau tokenii userului — vezi doar un dosar."
              confirmLabel="Pornește view-as"
              minLen={20}
              destructive
              trigger={<Button disabled={!uid || busy}><Eye className="mr-1 size-4" />Start view-as</Button>}
              onConfirm={async (reason) => {
                setBusy(true);
                try {
                  const r = await start({ data: { targetUserId: uid, purpose: "support", justification: reason } });
                  setDossier(r.dossier); setImpId(r.impersonationId);
                  const a = await getAuth({ data: { userId: uid } });
                  setAuthInfo(a);
                } catch (e: any) { toast.error(e?.message ?? "Eroare"); } finally { setBusy(false); }
              }}
            />
          </div>
        </div>
      </GlassCard>

      {impId && (
        <GlassCard>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Dosar user · sesiune view-as activă</p>
            <Button size="sm" variant="outline" onClick={async () => {
              await end({ data: { impersonationId: impId } });
              setImpId(null); setDossier(null); setAuthInfo(null);
              toast.success("View-as încheiat.");
            }}><EyeOff className="mr-1 size-3.5" />End</Button>
          </div>
          {dossier?.profile && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-surface-elevated p-3 text-xs">
                <p className="mb-1 font-semibold">{dossier.profile.display_name} ({dossier.profile.email})</p>
                <p>Vârstă status: {dossier.profile.age_status ?? "—"}</p>
                <p>Verificat: {String(dossier.profile.verified)}</p>
                <p>Rapoarte: {dossier.profile.report_count ?? 0}</p>
                <p>Ban: {dossier.profile.banned_at ?? "—"}</p>
                <p>Suspendat până: {dossier.profile.suspended_until ?? "—"}</p>
                <p>Roluri: {dossier.roles.join(", ") || "user"}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-elevated p-3 text-xs">
                <p className="mb-1 font-semibold">Activitate</p>
                <p>Match-uri (recent): {dossier.matchesCount}</p>
                <p>Conversații (recent): {dossier.conversationsCount}</p>
                <p>Ticket-uri deschise: {(dossier.tickets ?? []).filter((t: any) => t.status === "open").length}</p>
                <p>Rapoarte împotriva: {(dossier.reportsAgainst ?? []).length}</p>
                <p>Ultimele swipe-uri: {(dossier.recentSwipes ?? []).length}</p>
              </div>
            </div>
          )}

          {authInfo && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-semibold">Sesiuni & dispozitive</p>
              <div className="rounded-xl border border-border/60 bg-surface-elevated p-3 text-xs">
                <p>Ultima autentificare: {authInfo.user?.last_sign_in_at ?? "—"}</p>
                <p>Providers: {authInfo.user?.identities?.map((i: any) => i.provider).join(", ") || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ReasonDialog
                    title="Forțează logout pe TOATE sesiunile"
                    description="Se invalidează refresh tokens (ban 1s) și se dezactivează toate push subscriptions. Necesită MFA activ."
                    confirmLabel="Sign-out global"
                    destructive
                    minLen={10}
                    trigger={<Button size="sm" variant="destructive"><LogOut className="mr-1 size-3.5" />Force sign-out all</Button>}
                    onConfirm={async (reason) => {
                      await revokeAll({ data: { userId: uid, reason } });
                      const a = await getAuth({ data: { userId: uid } }); setAuthInfo(a);
                    }}
                  />
                </div>
                <div className="mt-3">
                  <p className="mb-1 font-semibold">Push subscriptions ({authInfo.pushSubscriptions?.length ?? 0})</p>
                  <ul className="space-y-1">
                    {(authInfo.pushSubscriptions ?? []).map((s: any) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 rounded-md bg-background/40 px-2 py-1">
                        <span className="flex items-center gap-2">
                          <Smartphone className="size-3" /> {s.platform ?? "?"}
                          <StatusBadge tone={s.disabled_at ? "rejected" : "approved"}>
                            {s.disabled_at ? "disabled" : "active"}
                          </StatusBadge>
                        </span>
                        {!s.disabled_at && (
                          <ReasonDialog
                            title="Dezactivează acest device"
                            confirmLabel="Dezactivează"
                            minLen={3}
                            trigger={<Button size="sm" variant="outline">Revoke</Button>}
                            onConfirm={async (reason) => {
                              await revokeSub({ data: { userId: uid, subscriptionId: s.id, reason } });
                              const a = await getAuth({ data: { userId: uid } }); setAuthInfo(a);
                            }}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function ImpersonationLogBlock() {
  const list = useServerFn(adminListImpersonations);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true); setErr(null);
    try { setRows(await list({ data: { limit: 200 } })); }
    catch (e: any) { setErr(e?.message ?? "Eroare"); } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);
  if (busy) return <Loader2 className="mx-auto mt-8 size-6 animate-spin" />;
  if (err) return <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-300">{err}</div>;
  return (
    <GlassCard>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground">
          <tr><th className="px-2 py-1 text-left">Started</th><th>Actor</th><th>Target</th><th>Purpose</th><th>Ended</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/50">
              <td className="px-2 py-1">{new Date(r.started_at).toLocaleString("ro-RO")}</td>
              <td className="px-2 py-1 text-center font-mono">{r.actor_id.slice(0, 8)}</td>
              <td className="px-2 py-1 text-center font-mono">{r.target_user_id.slice(0, 8)}</td>
              <td className="px-2 py-1 text-center">{r.purpose}</td>
              <td className="px-2 py-1 text-center">{r.ended_at ? new Date(r.ended_at).toLocaleString("ro-RO") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}
