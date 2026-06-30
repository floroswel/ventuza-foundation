/**
 * MODUL 3 — Staff Management UI.
 *
 * Listă staff cu roluri + MFA status + ultima verificare.
 * Acțiuni gated:
 *  - grant/revoke moderator/auditor/support/read_only → admin+
 *  - grant/revoke admin/super_admin → super_admin (enforced server-side)
 *  - IP allowlist → super_admin
 * Toate cer justification + MFA + audit.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert, Trash2, Plus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { ReasonDialog } from "./ReasonDialog";
import {
  adminListStaff, adminGrantStaffRole, adminRevokeStaffRole,
  adminListIpAllowlist, adminAddIpAllowlist, adminRemoveIpAllowlist,
} from "@/lib/admin-staff.functions";

const ALL_ROLES = ["super_admin", "admin", "auditor", "moderator", "support", "read_only"] as const;
type R = typeof ALL_ROLES[number];

function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
      <p className="font-semibold text-red-300">Eroare</p>
      <p className="mt-1 break-words text-xs text-red-200/90">{error}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-2">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reîncearcă
        </Button>
      )}
    </div>
  );
}

export function StaffManagementPanel() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [ips, setIps] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const list = useServerFn(adminListStaff);
  const listIps = useServerFn(adminListIpAllowlist);
  const grant = useServerFn(adminGrantStaffRole);
  const revoke = useServerFn(adminRevokeStaffRole);
  const addIp = useServerFn(adminAddIpAllowlist);
  const rmIp = useServerFn(adminRemoveIpAllowlist);

  async function reload() {
    setLoading(true); setError(null);
    try {
      const [s, i] = await Promise.all([list(), listIps().catch(() => ({ rows: [] as any[] }))]);
      setRows(s.rows);
      setIps(i.rows ?? []);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (error) return <ErrorBanner error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Staff &amp; roluri</h2>
        <div className="flex gap-2">
          <AddStaffDialog onSubmit={async (userId, role, reason) => {
            await grant({ data: { userId, role, justification: reason } });
            toast.success(`Acordat ${role}`);
            reload();
          }} />
          <Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Reload</Button>
        </div>
      </div>

      {(rows ?? []).length === 0
        ? <p className="text-sm text-muted-foreground">Niciun staff încă (empty legitim).</p>
        : (
          <div className="space-y-2">
            {rows!.map((u) => (
              <Card key={u.user_id} className="p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{u.display_name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{u.email ?? u.user_id}</span>
                      {u.mfa_enrolled
                        ? <Badge className="bg-emerald-500/20 text-emerald-300"><ShieldCheck className="h-3 w-3 mr-1" /> MFA</Badge>
                        : <Badge variant="outline" className="text-amber-300 border-amber-500/50"><ShieldAlert className="h-3 w-3 mr-1" /> NO MFA</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {u.roles.map((r: string) => (
                        <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                    {u.mfa_last_verified_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        ultima verif. MFA: {new Date(u.mfa_last_verified_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <RoleManager
                    user={u}
                    onGrant={async (role, reason) => {
                      await grant({ data: { userId: u.user_id, role, justification: reason } });
                      toast.success(`Acordat ${role}`); reload();
                    }}
                    onRevoke={async (role, reason) => {
                      await revoke({ data: { userId: u.user_id, role, justification: reason } });
                      toast.success(`Revocat ${role}`); reload();
                    }}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}

      {/* IP allowlist */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Admin IP allowlist</h2>
          <AddIpDialog onSubmit={async (cidr, label, reason) => {
            await addIp({ data: { cidr, label, justification: reason } });
            toast.success("CIDR adăugat"); reload();
          }} />
        </div>
        {(ips ?? []).length === 0
          ? <p className="text-sm text-muted-foreground">Allowlist goală (toate IP-urile staff sunt permise — enforced doar dacă feature flag e ON).</p>
          : (
            <div className="space-y-2">
              {ips!.map((ip) => (
                <Card key={ip.id} className="p-3 flex items-center justify-between">
                  <div>
                    <code className="text-sm">{ip.cidr}</code>
                    {ip.label && <span className="ml-2 text-xs text-muted-foreground">{ip.label}</span>}
                    <p className="text-[10px] text-muted-foreground">adăugat {new Date(ip.created_at).toLocaleString()}</p>
                  </div>
                  <ReasonDialog
                    trigger={<Button size="sm" variant="destructive"><Trash2 className="h-3.5 w-3.5 mr-1" /> Șterge</Button>}
                    title="Șterge CIDR din allowlist"
                    destructive
                    confirmLabel="Șterge"
                    onConfirm={async (r) => {
                      await rmIp({ data: { id: ip.id, justification: r } });
                      toast.success("Șters"); reload();
                    }}
                  />
                </Card>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

function RoleManager({
  user, onGrant, onRevoke,
}: { user: any; onGrant: (r: R, reason: string) => Promise<void>; onRevoke: (r: R, reason: string) => Promise<void> }) {
  const [role, setRole] = useState<R>("moderator");
  const hasRole = (r: string) => user.roles.includes(r);
  return (
    <div className="flex items-center gap-2">
      <Select value={role} onValueChange={(v) => setRole(v as R)}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>
      {hasRole(role) ? (
        <ReasonDialog
          trigger={<Button size="sm" variant="destructive">Revocă</Button>}
          title={`Revocă ${role} pentru ${user.display_name ?? user.user_id}`}
          destructive
          confirmLabel="Revocă"
          onConfirm={(r) => onRevoke(role, r)}
        />
      ) : (
        <ReasonDialog
          trigger={<Button size="sm">Acordă</Button>}
          title={`Acordă ${role} pentru ${user.display_name ?? user.user_id}`}
          confirmLabel="Acordă"
          onConfirm={(r) => onGrant(role, r)}
        />
      )}
    </div>
  );
}

function AddStaffDialog({ onSubmit }: { onSubmit: (userId: string, role: R, reason: string) => Promise<void> }) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<R>("moderator");
  return (
    <ReasonDialog
      trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adaugă staff</Button>}
      title="Acordă rol staff unui user existent"
      confirmLabel="Acordă"
      fields={
        <div className="space-y-2">
          <div>
            <Label>User ID (uuid)</Label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="ex: 4d2b…" />
          </div>
          <div>
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as R)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
      onConfirm={async (r) => {
        if (!/^[0-9a-f-]{36}$/i.test(userId.trim())) throw new Error("User ID invalid (uuid)");
        await onSubmit(userId.trim(), role, r);
      }}
    />
  );
}

function AddIpDialog({ onSubmit }: { onSubmit: (cidr: string, label: string | undefined, reason: string) => Promise<void> }) {
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  return (
    <ReasonDialog
      trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adaugă CIDR</Button>}
      title="Adaugă IP/CIDR în allowlist"
      confirmLabel="Adaugă"
      fields={
        <div className="space-y-2">
          <div>
            <Label>CIDR</Label>
            <Input value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="ex: 88.99.100.0/24" />
          </div>
          <div>
            <Label>Etichetă (opțional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: birou București" />
          </div>
        </div>
      }
      onConfirm={(r) => onSubmit(cidr.trim(), label.trim() || undefined, r)}
    />
  );
}
