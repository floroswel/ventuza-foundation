import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Power, PowerOff, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard, SectionTitle, StatusBadge } from "@/components/admin/ui/primitives";
import { ReasonDialog } from "@/components/admin/ReasonDialog";
import {
  getKillSwitches, setKillSwitch, getMinVersion, setMinVersion,
} from "@/lib/admin-intelligence.functions";

const KEYS: { key: "chat" | "matching" | "uploads" | "discover" | "signup" | "partner_portal"; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "matching", label: "Matching" },
  { key: "uploads", label: "Uploads media" },
  { key: "discover", label: "Discover feed" },
  { key: "signup", label: "Signup nou" },
  { key: "partner_portal", label: "Portal parteneri" },
];

export function KillSwitchesPanel() {
  const getKS = useServerFn(getKillSwitches);
  const setKS = useServerFn(setKillSwitch);
  const getMV = useServerFn(getMinVersion);
  const setMV = useServerFn(setMinVersion);
  const [ks, setKs] = useState<Record<string, boolean> | null>(null);
  const [mv, setMv] = useState<any>(null);
  const [web, setWeb] = useState(""); const [ios, setIos] = useState(""); const [android, setAndroid] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [k, v] = await Promise.all([getKS(), getMV()]);
      setKs(k); setMv(v);
      const vAny = v as any;
      setWeb(vAny?.web ?? "0.0.0"); setIos(vAny?.ios ?? "0.0.0"); setAndroid(vAny?.android ?? "0.0.0");
      setMsg(vAny?.force_update_message ?? "");
    } catch (e: any) { toast.error(e?.message ?? "Eroare"); } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  if (busy || !ks) return <Loader2 className="mx-auto mt-12 size-6 animate-spin" />;

  return (
    <div className="space-y-4">
      <SectionTitle>Kill switches (emergency)</SectionTitle>
      <GlassCard>
        <p className="mb-3 text-xs text-muted-foreground">
          Dezactivează instant module la nivel de app. Se logă în <code>admin_audit_log</code> ca <b>critical</b>.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {KEYS.map(({ key, label }) => {
            const on = !!ks[key];
            return (
              <div key={key} className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-elevated p-3">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <StatusBadge tone={on ? "rejected" : "approved"}>{on ? "DEZACTIVAT" : "activ"}</StatusBadge>
                </div>
                <ReasonDialog
                  title={on ? `Reactivează ${label}` : `Dezactivează ${label}`}
                  description={on ? "Modulul redevine disponibil userilor." : "TOȚI userii vor pierde accesul la acest modul instant."}
                  confirmLabel={on ? "Reactivează" : "Dezactivează"}
                  destructive={!on}
                  minLen={20}
                  trigger={
                    <Button size="sm" variant={on ? "default" : "destructive"}>
                      {on ? <Power className="mr-1 size-3.5" /> : <PowerOff className="mr-1 size-3.5" />}
                      {on ? "Turn ON" : "Kill"}
                    </Button>
                  }
                  onConfirm={async (reason) => {
                    const r = await setKS({ data: { key, on: !on, reason } });
                    setKs(r.killSwitches);
                  }}
                />
              </div>
            );
          })}
        </div>
      </GlassCard>

      <SectionTitle>Force-update (min supported version)</SectionTitle>
      <GlassCard>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Web</Label><Input value={web} onChange={(e) => setWeb(e.target.value)} placeholder="1.2.3" className="mt-1" /></div>
          <div><Label className="text-xs">iOS</Label><Input value={ios} onChange={(e) => setIos(e.target.value)} placeholder="1.2.3" className="mt-1" /></div>
          <div><Label className="text-xs">Android</Label><Input value={android} onChange={(e) => setAndroid(e.target.value)} placeholder="1.2.3" className="mt-1" /></div>
          <div className="sm:col-span-3">
            <Label className="text-xs">Mesaj afișat la user</Label>
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={280} className="mt-1" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Actualmente: web {(mv as any)?.web} · ios {(mv as any)?.ios} · android {(mv as any)?.android}</p>
          <ReasonDialog
            title="Publică minimum supported version"
            description="Toate device-urile sub aceste versiuni vor fi blocate până la update."
            confirmLabel="Publică"
            destructive
            minLen={20}
            trigger={<Button><Rocket className="mr-1 size-4" />Publică</Button>}
            onConfirm={async (reason) => {
              const r = await setMV({ data: { web, ios, android, force_update_message: msg, reason } });
              setMv(r.value);
            }}
          />
        </div>
      </GlassCard>
    </div>
  );
}
