/**
 * Enterprise User360 panel — 6 secțiuni într-un tab unic (integrat în /admin/users/$id):
 *  - Timeline unificat cronologic
 *  - Badge-uri manuale (acordare/revocare)
 *  - Strikes progresive (aplicare)
 *  - Ban temporar cu expirare
 *  - Legal hold (super_admin)
 *  - Mesaj oficial in-app
 *
 * Toate acțiunile cer justificare ≥ 10 caractere și trec prin MFA + audit
 * server-side. UI-ul ascunde acțiunile fără rol, dar nu este sursa de adevăr.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Award, ShieldAlert, Ban, Scale, MessageSquareWarning, Loader2, Briefcase } from "lucide-react";
import {
  adminApplyStrike, adminGetUserStrikes, adminSetTemporaryBan, adminSetLegalHold,
  adminSendOfficialMessage,
} from "@/lib/admin-enforcement.functions";
import {
  adminListManualBadges, adminListUserBadgeGrants, adminGrantBadge, adminRevokeBadge,
} from "@/lib/admin-badges.functions";
import { adminGetUserTimeline } from "@/lib/admin-timeline.functions";
import { adminGrantPartnerRole, adminRevokePartnerRole } from "@/lib/admin-partners.functions";

export function EnterpriseUser360Panel({ userId }: { userId: string }) {
  return (
    <div className="space-y-4">
      <TimelineSection userId={userId} />
      <div className="grid gap-4 md:grid-cols-2">
        <BadgesSection userId={userId} />
        <StrikesSection userId={userId} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <TemporaryBanSection userId={userId} />
        <LegalHoldSection userId={userId} />
        <OfficialMessageSection userId={userId} />
      </div>
    </div>
  );
}

/* =============== TIMELINE =============== */
function TimelineSection({ userId }: { userId: string }) {
  const fn = useServerFn(adminGetUserTimeline);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "user-timeline", userId],
    queryFn: () => fn({ data: { userId, limit: 200 } }),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold">Timeline unificat</h3>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto">
          Reîncarcă
        </Button>
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">Se încarcă…</div>}
      {error && <div className="text-sm text-destructive">Eroare: {(error as Error).message}</div>}
      {data && data.events.length === 0 && (
        <div className="text-sm text-muted-foreground">Niciun eveniment înregistrat.</div>
      )}
      {data && data.events.length > 0 && (
        <ol className="space-y-2 max-h-96 overflow-y-auto">
          {data.events.map((ev, i) => (
            <li key={i} className="flex items-start gap-2 text-sm border-l-2 pl-3 py-1"
                style={{ borderColor: ev.severity === "critical" ? "#ef4444"
                                    : ev.severity === "warning"  ? "#f59e0b" : "#94a3b8" }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{ev.kind}</Badge>
                  <span className="font-medium">{ev.title}</span>
                </div>
                {ev.details && <div className="text-xs text-muted-foreground mt-0.5 break-all">{ev.details}</div>}
                <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(ev.at).toLocaleString("ro-RO")}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* =============== BADGES =============== */
function BadgesSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const listManual = useServerFn(adminListManualBadges);
  const listGrants = useServerFn(adminListUserBadgeGrants);
  const grantFn = useServerFn(adminGrantBadge);
  const revokeFn = useServerFn(adminRevokeBadge);

  const catalog = useQuery({ queryKey: ["admin", "badge-catalog"], queryFn: () => listManual() });
  const grants = useQuery({
    queryKey: ["admin", "badge-grants", userId],
    queryFn: () => listGrants({ data: { userId } }),
  });

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [permanent, setPermanent] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");

  const grantMut = useMutation({
    mutationFn: async () => grantFn({ data: {
      userId, code,
      expiresAt: permanent ? null : new Date(expiresAt).toISOString(),
      reason,
    }}),
    onSuccess: () => {
      toast.success("Badge acordat");
      setOpen(false); setCode(""); setReason(""); setExpiresAt(""); setPermanent(true);
      qc.invalidateQueries({ queryKey: ["admin", "badge-grants", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: async (args: { code: string; reason: string }) =>
      revokeFn({ data: { userId, code: args.code, reason: args.reason } }),
    onSuccess: () => {
      toast.success("Badge revocat");
      qc.invalidateQueries({ queryKey: ["admin", "badge-grants", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold">Badge-uri manuale</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="ml-auto">Acordă</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Acordă badge</DialogTitle>
              <DialogDescription>Necesită MFA + audit critical.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Badge</Label>
                <Select value={code} onValueChange={(v) => {
                  setCode(v);
                  const b = catalog.data?.badges.find((x: any) => x.code === v);
                  if (b) setPermanent(b.default_permanent);
                }}>
                  <SelectTrigger><SelectValue placeholder="Alege badge" /></SelectTrigger>
                  <SelectContent>
                    {catalog.data?.badges.map((b: any) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.label_i18n?.ro ?? b.code} {b.effect ? `· ${b.effect}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input id="perm" type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
                <Label htmlFor="perm">Permanent</Label>
              </div>
              {!permanent && (
                <div>
                  <Label>Expiră la</Label>
                  <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              )}
              <div>
                <Label>Motiv (min. 10 caractere)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
              <Button
                disabled={!code || reason.length < 10 || (!permanent && !expiresAt) || grantMut.isPending}
                onClick={() => grantMut.mutate()}
              >
                {grantMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Acordă
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {grants.isLoading && <div className="text-sm text-muted-foreground">Se încarcă…</div>}
      {grants.error && <div className="text-sm text-destructive">Eroare: {(grants.error as Error).message}</div>}
      {grants.data && grants.data.grants.length === 0 && (
        <div className="text-sm text-muted-foreground">Niciun badge manual acordat.</div>
      )}
      <ul className="space-y-2">
        {grants.data?.grants.map((g: any) => {
          const active = !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > new Date());
          return (
            <li key={g.id} className="flex items-center gap-2 text-sm border rounded p-2">
              <Badge variant={active ? "default" : "outline"}>{g.badge_code}</Badge>
              <div className="text-xs text-muted-foreground flex-1 truncate">
                {g.expires_at ? `expiră ${new Date(g.expires_at).toLocaleDateString("ro-RO")}` : "permanent"}
                {g.revoked_at ? ` · revocat ${new Date(g.revoked_at).toLocaleDateString("ro-RO")}` : ""}
              </div>
              {active && (
                <Button size="sm" variant="ghost" onClick={() => {
                  const r = window.prompt("Motiv revocare (min. 10):");
                  if (r && r.length >= 10) revokeMut.mutate({ code: g.badge_code, reason: r });
                }}>Revocă</Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* =============== STRIKES =============== */
function StrikesSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetUserStrikes);
  const applyFn = useServerFn(adminApplyStrike);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "strikes", userId],
    queryFn: () => getFn({ data: { userId } }),
  });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: async () => applyFn({ data: { userId, reason } }),
    onSuccess: (r: any) => {
      toast.success(`Strike aplicat: ${r.result?.action}`);
      setOpen(false); setReason("");
      qc.invalidateQueries({ queryKey: ["admin", "strikes", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "user-timeline", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-orange-500" />
        <h3 className="font-semibold">Strikes ({data?.active.length ?? 0} active)</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="destructive" className="ml-auto">Aplică strike</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aplică strike progresiv</DialogTitle>
              <DialogDescription>
                1=warning · 2=mute 24h · 3=shadowban · 4=ban 30z · 5=ban permanent. Escaladarea e automată.
              </DialogDescription>
            </DialogHeader>
            <Textarea placeholder="Motiv (min. 5)" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
              <Button disabled={reason.length < 5 || mut.isPending} onClick={() => mut.mutate()}>
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Aplică
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">Se încarcă…</div>}
      <ul className="space-y-1 text-sm">
        {data?.history.slice(0, 10).map((s: any) => (
          <li key={s.id} className="flex items-center gap-2">
            <Badge variant={s.severity >= 4 ? "destructive" : "outline"}>sev {s.severity}</Badge>
            <span className="truncate flex-1">{s.reason}</span>
            <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("ro-RO")}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* =============== TEMPORARY BAN =============== */
function TemporaryBanSection({ userId }: { userId: string }) {
  const banFn = useServerFn(adminSetTemporaryBan);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [preset, setPreset] = useState("");

  const applyPreset = (hours: number) => {
    const d = new Date(Date.now() + hours * 3600 * 1000);
    setUntil(d.toISOString().slice(0, 16));
  };

  const mut = useMutation({
    mutationFn: async (lift: boolean) => banFn({ data: {
      userId,
      until: lift ? null : new Date(until).toISOString(),
      reason,
    }}),
    onSuccess: () => { toast.success("Aplicat"); setReason(""); setUntil(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2"><Ban className="w-4 h-4 text-red-500" /><h3 className="font-semibold">Ban temporar</h3></div>
      <div className="flex gap-1 flex-wrap">
        {[[1,"1h"],[24,"24h"],[168,"7z"],[720,"30z"]].map(([h,l]) => (
          <Button key={l as string} size="sm" variant="outline" onClick={() => applyPreset(h as number)}>{l as string}</Button>
        ))}
      </div>
      <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
      <Textarea placeholder="Motiv (min. 10)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" disabled={!until || reason.length < 10 || mut.isPending}
                onClick={() => mut.mutate(false)}>Aplică ban</Button>
        <Button size="sm" variant="ghost" disabled={reason.length < 10 || mut.isPending}
                onClick={() => mut.mutate(true)}>Ridică ban</Button>
      </div>
    </Card>
  );
}

/* =============== LEGAL HOLD =============== */
function LegalHoldSection({ userId }: { userId: string }) {
  const fn = useServerFn(adminSetLegalHold);
  const [reason, setReason] = useState("");
  const mut = useMutation({
    mutationFn: async (enable: boolean) => fn({ data: { userId, enable, reason } }),
    onSuccess: () => { toast.success("Legal hold actualizat"); setReason(""); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2"><Scale className="w-4 h-4 text-blue-500" /><h3 className="font-semibold">Legal hold</h3></div>
      <p className="text-xs text-muted-foreground">Doar super_admin. Blochează ștergerea contului.</p>
      <Textarea placeholder="Motiv legal (min. 10)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" disabled={reason.length < 10 || mut.isPending}
                onClick={() => mut.mutate(true)}>Activează</Button>
        <Button size="sm" variant="outline" disabled={reason.length < 10 || mut.isPending}
                onClick={() => mut.mutate(false)}>Dezactivează</Button>
      </div>
    </Card>
  );
}

/* =============== OFFICIAL MESSAGE =============== */
function OfficialMessageSection({ userId }: { userId: string }) {
  const fn = useServerFn(adminSendOfficialMessage);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const mut = useMutation({
    mutationFn: async () => fn({ data: { userId, subject: subject || undefined, body } }),
    onSuccess: () => { toast.success("Mesaj oficial trimis"); setSubject(""); setBody(""); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2"><MessageSquareWarning className="w-4 h-4 text-fuchsia-500" /><h3 className="font-semibold">Mesaj oficial</h3></div>
      <p className="text-xs text-muted-foreground">Ajunge în inbox + notificare push. Audit warning.</p>
      <Input placeholder="Subiect (opțional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <Textarea placeholder="Mesaj (min. 3)" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      <Button size="sm" disabled={body.length < 3 || mut.isPending} onClick={() => mut.mutate()}>
        {mut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Trimite
      </Button>
    </Card>
  );
}
