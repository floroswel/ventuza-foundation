/**
 * WAVE 1 admin panels — M1 (User detail drawer), M13 (GDPR ops), M14 (Audit + Break-glass).
 *
 * Reguli aplicate:
 *  - Niciun câmp Art. 9 / locație / mesaj brut randat fără break-glass + log.
 *  - Toate acțiunile cu efect = confirmare + justificare ≥ N chars + audit.
 *  - CSAM nu se randează niciodată — vezi CsamPanel (EnterpriseSections) +
 *    proiecția server-side din `adminGetCsamReports` care exclude `photo_url`.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShieldAlert,
  Eye,
  EyeOff,
  LogOut,
  KeyRound,
  BadgeCheck,
  Trash2,
  RefreshCw,
  Download,
  ScrollText,
  FileText,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  adminGetUserView,
  adminGetUserConsentHistory,
  adminForceLogout,
  adminTriggerPasswordReset,
  adminCancelDeletion,
  adminPurgeUserAccount,
  adminRunPurgeNow,
  adminGetGdprTrail,
} from "@/lib/admin-wave1.functions";
import { adminBreakGlassReveal, adminListBreakGlass } from "@/lib/admin-break-glass.functions";
import { adminGetDeletionRequests } from "@/lib/admin-enterprise.functions";

/* =================================================================
   M1 — USER DETAIL DRAWER (mascat by default + break-glass)
================================================================= */
type Kind = "orientation" | "location" | "messages";

export function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const getView = useServerFn(adminGetUserView);
  const getConsents = useServerFn(adminGetUserConsentHistory);
  const forceLogout = useServerFn(adminForceLogout);
  const passwordReset = useServerFn(adminTriggerPasswordReset);
  const purge = useServerFn(adminPurgeUserAccount);
  const reveal = useServerFn(adminBreakGlassReveal);

  const [view, setView] = useState<any>(null);
  const [consents, setConsents] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Partial<Record<Kind, any>>>({});

  const load = async () => {
    setBusy(true);
    try {
      const [v, c] = await Promise.all([
        getView({ data: { userId } }),
        getConsents({ data: { userId } }),
      ]);
      setView(v);
      setConsents(c);
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [userId]);

  const ask = (prompt_: string, min = 10) => {
    const j = window.prompt(prompt_);
    if (!j || j.length < min) {
      toast.error(`Justificare minim ${min} caractere`);
      return null;
    }
    return j;
  };

  const onReveal = async (kind: Kind) => {
    const j = ask(`Justificare break-glass [${kind}] (min 10):`);
    if (!j) return;
    try {
      const r = await reveal({ data: { targetUserId: userId, kind, justification: j } });
      setRevealed((s) => ({ ...s, [kind]: r.payload }));
      toast.warning(`Acces ${kind} înregistrat în jurnalul sensibil.`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onForceLogout = async () => {
    const j = ask("Justificare force-logout (min 5):", 5);
    if (!j) return;
    try {
      await forceLogout({ data: { userId, justification: j } });
      toast.success("Logout forțat");
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const onResetPwd = async () => {
    const j = ask("Justificare reset parolă (min 5):", 5);
    if (!j) return;
    try {
      await passwordReset({ data: { userId, justification: j } });
      toast.success("Email reset trimis");
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  // Aprobarea manuală „vârstă" a fost eliminată — verificarea trece exclusiv prin
  // panoul intern (`/admin/verification`) unde un moderator ia decizia auditată.

  const onPurge = async () => {
    if (!confirm("Ștergere completă cont (RC cancel + storage + cascade). Ireversibil. Continui?"))
      return;
    const j = ask("Justificare ștergere GDPR Art. 17 (min 10):");
    if (!j) return;
    try {
      await purge({ data: { userId, justification: j } });
      toast.success("Cont șters");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-background p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">User · {userId.slice(0, 8)}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-surface">
            <X className="size-4" />
          </button>
        </div>

        {busy && <p className="mt-4 text-sm text-muted-foreground">Se încarcă...</p>}
        {view && (
          <>
            <section className="mt-4 rounded-2xl border border-border bg-surface p-3">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                Profil (mascat)
              </h3>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate" title={view.profile?.display_name ?? ""}>
                  {isOffensiveName(view.profile?.display_name) ? (
                    <span className="text-amber-400">{maskName(view.profile?.display_name)}</span>
                  ) : (
                    (view.profile?.display_name ?? "—")
                  )}
                  {view.profile?.is_premium && (
                    <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] uppercase text-amber-300">
                      premium
                    </span>
                  )}
                  {view.profile?.banned_at && (
                    <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] uppercase text-red-300">
                      BANAT
                    </span>
                  )}
                </p>
                <Link
                  to="/admin/users/$id"
                  params={{ id: userId }}
                  className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] text-primary shrink-0"
                >
                  User 360 →
                </Link>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <Row k="Email" v={view.profile?.auth_email ?? "—"} />
                <Row
                  k="Email confirmat"
                  v={
                    view.profile?.auth_email_confirmed_at
                      ? new Date(view.profile.auth_email_confirmed_at).toLocaleDateString("ro-RO")
                      : "nu"
                  }
                />
                <Row k="Provideri auth" v={(view.profile?.auth_providers ?? []).join(", ") || "email"} />
                <Row k="Slug" v={view.profile?.profile_slug ?? "—"} />
                <Row k="Oraș" v={view.profile?.travel_city ?? "—"} />
                <Row k="Vârstă" v={view.profile?.age != null ? String(view.profile.age) : "—"} />
                <Row k="Ascunde vârsta" v={view.profile?.hide_age ? "DA" : "NU"} />
                <Row k="Level / XP" v={`${view.profile?.level ?? 0} · ${view.profile?.xp ?? 0} XP`} />
                <Row k="Streak" v={`${view.profile?.streak_days ?? 0} zile`} />
                <Row k="Completare" v={`${view.profile?.profile_completion ?? 0}%`} />
                <Row k="Risk score" v={String(view.profile?.risk_score ?? 0)} />
                <Row k="Rapoarte primite" v={String(view.profile?.report_count ?? 0)} />
                <Row k="Verificat" v={view.profile?.verified ? "DA" : "NU"} />
                <Row
                  k="Status verif."
                  v={view.profile?.verification_status ?? view.profile?.age_status ?? "—"}
                />
                <Row k="Limbă" v={view.profile?.preferred_language ?? "—"} />
                <Row k="Onboarding" v={view.profile?.onboarding_completed ? "DA" : "NU"} />
                <Row
                  k="Cont creat"
                  v={
                    view.profile?.created_at
                      ? new Date(view.profile.created_at).toLocaleDateString("ro-RO")
                      : "—"
                  }
                />
                <Row
                  k="Ultim activ"
                  v={
                    view.profile?.last_active_at
                      ? new Date(view.profile.last_active_at).toLocaleString("ro-RO")
                      : "—"
                  }
                />
                <Row
                  k="Boost activ"
                  v={
                    view.profile?.boost_until && new Date(view.profile.boost_until) > new Date()
                      ? `până ${new Date(view.profile.boost_until).toLocaleString("ro-RO")}`
                      : "nu"
                  }
                />
                <Row
                  k="Balanță"
                  v={`${view.profile?.boosts_balance ?? 0} boost · ${view.profile?.super_taps_balance ?? 0} taps`}
                />
                <Row
                  k="Suspendat"
                  v={
                    view.profile?.suspended_until &&
                    new Date(view.profile.suspended_until) > new Date()
                      ? `până ${new Date(view.profile.suspended_until).toLocaleDateString("ro-RO")}`
                      : "nu"
                  }
                />
                <Row
                  k="Partener suspend."
                  v={
                    view.profile?.partner_suspended_at
                      ? new Date(view.profile.partner_suspended_at).toLocaleDateString("ro-RO")
                      : "nu"
                  }
                />
                <Row
                  k="Soft-deleted"
                  v={
                    view.profile?.deleted_at
                      ? new Date(view.profile.deleted_at).toLocaleDateString("ro-RO")
                      : "nu"
                  }
                />
              </dl>

              {Array.isArray(view.profile?.interests) && view.profile.interests.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Interese</div>
                  <div className="flex flex-wrap gap-1">
                    {view.profile.interests.slice(0, 20).map((t: string, i: number) => (
                      <span key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {view.profile?.prompts && (() => {
                const p = view.profile.prompts;
                const entries: Array<[string, string]> = Array.isArray(p)
                  ? p.map((x: any) => [String(x?.q ?? x?.question ?? ""), String(x?.a ?? x?.answer ?? "")])
                  : typeof p === "object"
                    ? Object.entries(p).map(([k, v]) => [k, String(v ?? "")])
                    : [];
                const filtered = entries.filter(([, a]) => a && a.trim());
                if (!filtered.length) return null;
                return (
                  <div className="mt-2">
                    <div className="text-[10px] uppercase text-muted-foreground mb-1">Prompturi</div>
                    <ul className="space-y-1">
                      {filtered.slice(0, 6).map(([q, a], i) => (
                        <li key={i} className="rounded border border-border bg-background/50 p-1.5 text-[11px]">
                          {q && <div className="text-muted-foreground">{q}</div>}
                          <div>{a}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {view.profile?.bio && (
                <p className="mt-2 rounded border border-border bg-background/50 p-2 text-[11px] italic text-muted-foreground">
                  „{view.profile.bio}"
                </p>
              )}
              {view.profile?.banned_reason && (
                <p className="mt-1 text-[10px] text-red-300">
                  Motiv ban: {view.profile.banned_reason}
                </p>
              )}
              {view.profile?.suspended_reason && (
                <p className="mt-1 text-[10px] text-amber-300">
                  Motiv suspendare: {view.profile.suspended_reason}
                </p>
              )}
              <p className="mt-2 text-[10px] text-muted-foreground">
                Roluri: <b>{view.roles.join(", ") || "user"}</b>
                {" · "}Rapoarte făcute: {view.reports?.length ?? 0}
                {" · "}Cereri verificare: {view.verifications?.length ?? 0}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Orientarea, pronumele, tribes, HIV, locația precisă și mesajele brute (Art. 9) rămân
                mascate — folosește <b>break-glass</b> pentru dezvăluire cu audit.
              </p>
            </section>





            {/* BREAK-GLASS BUTTONS — fiecare categorie loghează separat */}
            <section className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-red-500" />
                <h3 className="text-xs uppercase tracking-wide text-red-300">
                  Dezvăluire date sensibile (break-glass)
                </h3>
              </div>
              <p className="mt-1 text-[10px] text-red-300/80">
                Necesită rol corespunzător + justificare. Logat în admin_sensitive_access_log
                (high). Location/Orientation = super_admin. Messages = admin+.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["orientation", "location", "messages"] as Kind[]).map(
                  (k) => (
                    <button
                      key={k}
                      onClick={() => onReveal(k)}
                      className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-300"
                    >
                      <Eye className="mr-1 inline size-3" /> {k}
                    </button>
                  ),
                )}
              </div>
              {Object.entries(revealed).map(([k, v]) => (
                <div key={k} className="mt-2 rounded-xl border border-red-500/30 bg-background p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-red-400">{k}</span>
                    <button
                      onClick={() =>
                        setRevealed((s) => {
                          const c = { ...s };
                          delete (c as any)[k];
                          return c;
                        })
                      }
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <EyeOff className="mr-1 inline size-3" />
                      ascunde
                    </button>
                  </div>
                  <pre className="mt-1 overflow-x-auto text-[10px]">
                    {JSON.stringify(v, null, 2)}
                  </pre>
                </div>
              ))}
            </section>

            <section className="mt-3 rounded-2xl border border-border bg-surface p-3">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                Acțiuni cont
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={onForceLogout}
                  className="rounded-full bg-orange-500/15 px-3 py-1.5 text-xs text-orange-400"
                >
                  <LogOut className="mr-1 inline size-3" /> Force logout
                </button>
                <button
                  onClick={onResetPwd}
                  className="rounded-full bg-primary/15 px-3 py-1.5 text-xs text-primary"
                >
                  <KeyRound className="mr-1 inline size-3" /> Reset parolă
                </button>
                <Link
                  to="/admin/users/$id"
                  params={{ id: userId }}
                  className="rounded-full bg-primary/15 px-3 py-1.5 text-xs text-primary"
                >
                  <BadgeCheck className="mr-1 inline size-3" /> User 360
                </Link>
                <a
                  href="/admin#verifqueue"
                  className="rounded-full bg-green-500/15 px-3 py-1.5 text-xs text-green-400"
                >
                  <BadgeCheck className="mr-1 inline size-3" /> Coadă verificare
                </a>
                <button
                  onClick={onPurge}
                  className="rounded-full bg-red-700/20 px-3 py-1.5 text-xs text-red-400"
                >
                  <Trash2 className="mr-1 inline size-3" /> Ștergere GDPR
                </button>
              </div>
            </section>

            <section className="mt-3 rounded-2xl border border-border bg-surface p-3">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                Istoric consimțăminte ({consents.length})
              </h3>
              <ul className="mt-2 space-y-1">
                {consents.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-[11px]">
                    <span>
                      <span className="font-mono">{c.kind}</span> · v{c.version}
                    </span>
                    <span className={c.accepted ? "text-green-400" : "text-red-400"}>
                      {c.accepted ? "✓ acceptat" : "✗ retras"} ·{" "}
                      {new Date(c.created_at).toLocaleString("ro-RO")}
                    </span>
                  </li>
                ))}
                {!consents.length && (
                  <li className="text-[11px] text-muted-foreground">
                    Niciun consimțământ înregistrat.
                  </li>
                )}
              </ul>
            </section>

            <section className="mt-3 rounded-2xl border border-border bg-surface p-3">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                Rapoarte împotriva ({view.reports.length})
              </h3>
              <ul className="mt-2 space-y-1">
                {view.reports.slice(0, 10).map((r: any) => (
                  <li key={r.id} className="text-[11px]">
                    <span className="font-mono">{r.reason}</span> · {r.status} ·{" "}
                    {new Date(r.created_at).toLocaleString("ro-RO")}
                  </li>
                ))}
                {!view.reports.length && (
                  <li className="text-[11px] text-muted-foreground">Niciun raport.</li>
                )}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/* =================================================================
   M13 — GDPR OPS (extins: cancel deletion, manual purge, trail)
================================================================= */
export function GdprOpsPanel() {
  const getDel = useServerFn(adminGetDeletionRequests);
  const cancel = useServerFn(adminCancelDeletion);
  const runPurge = useServerFn(adminRunPurgeNow);
  const getTrail = useServerFn(adminGetGdprTrail);

  const [items, setItems] = useState<any[]>([]);
  const [trail, setTrail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      // Încărcăm separat ca o eroare la trail (poate cere super_admin pe instanțe restricte)
      // să NU mascheze cererile de ștergere (admin normal le poate vedea).
      const [delRes, trailRes] = await Promise.allSettled([
        getDel(),
        getTrail({ data: { limit: 200 } }),
      ]);
      if (delRes.status === "fulfilled") setItems(delRes.value);
      else throw delRes.reason;
      if (trailRes.status === "fulfilled") setTrail(trailRes.value);
      else {
        setTrail([]); /* trail e secundar, ignorăm */
      }
    } catch (e: any) {
      const m = e?.message ?? String(e);
      setError(m);
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const ask = (msg: string, min = 10) => {
    const j = window.prompt(msg);
    if (!j || j.length < min) {
      toast.error(`Justificare min ${min}`);
      return null;
    }
    return j;
  };

  const onCancel = async (id: string) => {
    const j = ask("Justificare anulare cerere (min 5):", 5);
    if (!j) return;
    try {
      await cancel({ data: { requestId: id, justification: j } });
      toast.success("Anulat");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const onRunPurge = async () => {
    if (!confirm("Rulează purge programat ACUM? Ștergere fizică pentru toate cererile scadente."))
      return;
    const j = ask("Justificare (super_admin, min 10):");
    if (!j) return;
    try {
      const r = await runPurge({ data: { justification: j } });
      toast.success(`Purge OK: ${JSON.stringify(r.result)}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Download className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">GDPR — operațiuni</h2>
        <button
          onClick={onRunPurge}
          className="ml-auto rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-400"
        >
          <Trash2 className="mr-1 inline size-3" /> Execută purge acum (super_admin)
        </button>
        <button onClick={load} className="rounded-full border border-border px-3 py-1.5 text-xs">
          <RefreshCw className="mr-1 inline size-3" /> Reîncarcă
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-3 text-xs">
          <p className="font-semibold text-red-300">Eroare la încărcare</p>
          <p className="mt-1 text-red-200/90 break-words">{error}</p>
        </div>
      )}
      {loading && !error && (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          Se încarcă…
        </div>
      )}

      <section>
        <h3 className="mb-2 text-xs uppercase text-muted-foreground">
          Cereri ștergere ({items.length})
        </h3>
        {!loading && !items.length ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            Nicio cerere de ștergere (empty legitim).
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((d) => {
              const due = new Date(d.scheduled_for) <= new Date();
              return (
                <li
                  key={d.id}
                  className={`rounded-2xl border p-3 ${due ? "border-red-500/40 bg-red-500/5" : "border-border bg-surface"}`}
                >
                  <p className="text-xs">
                    user <span className="font-mono">{d.user_id.slice(0, 8)}</span> · status{" "}
                    <b>{d.status}</b>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    cerut {new Date(d.requested_at).toLocaleString("ro-RO")} · programat{" "}
                    {new Date(d.scheduled_for).toLocaleString("ro-RO")}
                  </p>
                  {d.reason && <p className="mt-1 text-[10px]">"{d.reason}"</p>}
                  {d.status === "scheduled" && (
                    <button
                      onClick={() => onCancel(d.id)}
                      className="mt-2 rounded-full border border-border px-3 py-1.5 text-xs"
                    >
                      Anulează
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs uppercase text-muted-foreground">
          Trail GDPR + backfill ({trail.length})
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-xs">
            <thead className="bg-background/50">
              <tr>
                <th className="px-2 py-2 text-left">Când</th>
                <th className="px-2 py-2 text-left">Acțiune</th>
                <th className="px-2 py-2 text-left">Sev.</th>
                <th className="px-2 py-2 text-left">Țintă</th>
                <th className="px-2 py-2 text-left">Motiv</th>
              </tr>
            </thead>
            <tbody>
              {trail.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-2 py-2 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("ro-RO")}
                  </td>
                  <td className="px-2 py-2 font-mono">{r.action}</td>
                  <td className="px-2 py-2">{r.severity}</td>
                  <td className="px-2 py-2 font-mono text-[10px]">
                    {(r.target_id ?? "").slice(0, 8)}
                  </td>
                  <td className="px-2 py-2 max-w-[280px] truncate">{r.justification ?? "—"}</td>
                </tr>
              ))}
              {!trail.length && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Niciun eveniment GDPR.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* =================================================================
   M14 — BREAK-GLASS VIEWER (super_admin / auditor)
================================================================= */
export function BreakGlassLogPanel() {
  const list = useServerFn(adminListBreakGlass);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await list({ data: { limit: 300 } });
      setRows(r.rows);
    } catch (e: any) {
      const m = e?.message ?? String(e);
      setError(m);
      // Nu deranjăm cu toast pe acces refuzat — banner-ul explică deja DE CE.
      if (!/forbidden|denied|rol|role/i.test(m)) toast.error(m);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const forbidden = error && /forbidden|denied|insufficient|rol|role/i.test(error);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-red-500" />
        <h2 className="text-lg font-semibold">Acces date sensibile (break-glass)</h2>
        <span className="text-xs text-muted-foreground">append-only · super_admin / auditor</span>
        <button
          onClick={load}
          disabled={busy}
          className="ml-auto rounded-full border border-border px-3 py-1.5 text-xs"
        >
          <RefreshCw className="mr-1 inline size-3" /> Reîncarcă
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
          <p className="font-semibold text-red-300">
            {forbidden ? "Acces refuzat" : "Eroare la încărcare"}
          </p>
          <p className="mt-1 break-words text-xs text-red-200/90">{error}</p>
          {forbidden && (
            <p className="mt-2 text-[11px] text-red-200/70">
              Acest jurnal cere rol <code>super_admin</code> sau <code>auditor</code>. Cere unui
              super-admin să-ți acorde rolul:{" "}
              <code>SELECT public.grant_user_role('&lt;uid&gt;', 'auditor')</code>.
            </p>
          )}
          <button
            onClick={load}
            className="mt-2 rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
          >
            Reîncearcă
          </button>
        </div>
      ) : busy && rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          Se încarcă…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-xs">
            <thead className="bg-background/50">
              <tr>
                <th className="px-2 py-2 text-left">Când</th>
                <th className="px-2 py-2 text-left">Actor</th>
                <th className="px-2 py-2 text-left">Țintă</th>
                <th className="px-2 py-2 text-left">Kind</th>
                <th className="px-2 py-2 text-left">Câmpuri</th>
                <th className="px-2 py-2 text-left">Motiv</th>
                <th className="px-2 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const kindColor =
                  r.kind === "health" || r.kind === "orientation"
                    ? "bg-red-500/20 text-red-300"
                    : r.kind === "location"
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-yellow-500/20 text-yellow-400";
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-2 py-2 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("ro-RO")}
                    </td>
                    <td className="px-2 py-2 font-mono text-[10px]">{r.actor_id?.slice(0, 8)}</td>
                    <td className="px-2 py-2 font-mono text-[10px]">
                      {r.target_user_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${kindColor}`}>
                        {r.kind}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[10px]">{(r.fields ?? []).join(", ")}</td>
                    <td className="px-2 py-2 max-w-[260px] truncate">{r.justification}</td>
                    <td className="px-2 py-2 font-mono text-[10px]">{r.ip ?? "—"}</td>
                  </tr>
                );
              })}
              {!rows.length && !busy && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Niciun acces sensibil înregistrat (empty legitim — apare la prima utilizare a
                    break-glass).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Rând compact key/value pentru drawer-ul de user. */
function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate font-medium text-foreground" title={v}>
        {v}
      </dd>
    </>
  );
}

