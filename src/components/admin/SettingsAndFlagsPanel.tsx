/**
 * MODUL 2 — Settings & Flags UI.
 *
 * Forme validate pentru cele mai folosite chei din `app_settings` + fallback
 * JSON pentru orice altă cheie. Feature flags: toggle on/off + rollout %.
 * Fiecare modificare cere justification (ReasonDialog) → server fn cu MFA.
 *
 * Stări obligatorii AdminPanel: loading / error (cu Reîncearcă) / empty.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, History, Save, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import { ReasonDialog } from "./ReasonDialog";
import {
  adminListSettings, adminUpdateSetting, adminSettingHistory,
  adminListFlags, adminUpsertFlag,
} from "@/lib/admin-settings.functions";

function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const forbidden = /forbidden|denied|insufficient|rol|role|policy|permission|mfa/i.test(error);
  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
      <p className="font-semibold text-red-300">{forbidden ? "Acces refuzat" : "Eroare"}</p>
      <p className="mt-1 break-words text-xs text-red-200/90">{error}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-2">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reîncearcă
        </Button>
      )}
    </div>
  );
}

/* ===================== STRUCTURED EDITORS ===================== */

type Setting = { key: string; value: any; category: string | null; description: string | null; version: number };

function NumberEditor({
  label, value, onChange, min, max, step = 1, suffix,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}{suffix ? ` (${suffix})` : ""}</Label>
      <Input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))} className="mt-1" />
    </div>
  );
}

function ProximityForm({ row, onSave }: { row: Setting; onSave: (val: any, reason: string) => Promise<void> }) {
  const [v, setV] = useState<any>(row.value ?? {});
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberEditor label="Cooldown" suffix="ore" value={v.cooldown_hours ?? 24} onChange={(x) => setV({ ...v, cooldown_hours: x })} min={1} max={72} />
      <NumberEditor label="Cap zilnic / user" value={v.daily_cap_per_user ?? 8} onChange={(x) => setV({ ...v, daily_cap_per_user: x })} min={1} max={50} />
      <NumberEditor label="Rază default" suffix="m" value={v.default_radius_m ?? 2000} onChange={(x) => setV({ ...v, default_radius_m: x })} min={100} max={20000} step={100} />
      <NumberEditor label="Rază max" suffix="m" value={v.max_radius_m ?? 5000} onChange={(x) => setV({ ...v, max_radius_m: x })} min={500} max={50000} step={100} />
      <NumberEditor label="Quiet start" suffix="0–23" value={v.quiet_start_hour ?? 22} onChange={(x) => setV({ ...v, quiet_start_hour: x })} min={0} max={23} />
      <NumberEditor label="Quiet end" suffix="0–23" value={v.quiet_end_hour ?? 8} onChange={(x) => setV({ ...v, quiet_end_hour: x })} min={0} max={23} />
      <div className="col-span-2 flex justify-end">
        <ReasonDialog
          trigger={<Button size="sm"><Save className="h-4 w-4 mr-1" /> Salvează</Button>}
          title="Salvează proximity notifications"
          confirmLabel="Salvează"
          onConfirm={(r) => onSave(v, r)}
        />
      </div>
    </div>
  );
}

function QuotasForm({ row, onSave }: { row: Setting; onSave: (val: any, reason: string) => Promise<void> }) {
  const [v, setV] = useState<any>(row.value ?? {});
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberEditor label="Max venues" value={v.max_venues ?? 10} onChange={(x) => setV({ ...v, max_venues: x })} min={1} max={500} />
      <NumberEditor label="Max events" value={v.max_events ?? 50} onChange={(x) => setV({ ...v, max_events: x })} min={1} max={1000} />
      <NumberEditor label="Max active offers" value={v.max_active_offers ?? 20} onChange={(x) => setV({ ...v, max_active_offers: x })} min={1} max={500} />
      <NumberEditor label="Max drafts / oră" value={v.max_drafts_per_hour ?? 5} onChange={(x) => setV({ ...v, max_drafts_per_hour: x })} min={1} max={100} />
      <div className="col-span-2 flex justify-end">
        <ReasonDialog
          trigger={<Button size="sm"><Save className="h-4 w-4 mr-1" /> Salvează</Button>}
          title="Salvează partner_quotas"
          confirmLabel="Salvează"
          onConfirm={(r) => onSave(v, r)}
        />
      </div>
    </div>
  );
}

function ScoreWeightsForm({ row, onSave }: { row: Setting; onSave: (val: any, reason: string) => Promise<void> }) {
  const [v, setV] = useState<any>(row.value ?? {});
  const sum = ["distance", "recent", "interests", "verified", "premium"].reduce(
    (a, k) => a + Number(v[k] ?? 0), 0,
  );
  const ok = Math.abs(sum - 1) < 0.01;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {(["distance", "recent", "interests", "verified", "premium"] as const).map((k) => (
          <NumberEditor key={k} label={k} value={Number(v[k] ?? 0)} step={0.05} min={0} max={1}
            onChange={(x) => setV({ ...v, [k]: x })} />
        ))}
      </div>
      <p className={`text-xs ${ok ? "text-emerald-400" : "text-amber-400"}`}>
        Suma curentă: {sum.toFixed(2)} {ok ? "✓ ok" : "(trebuie ≈ 1.00)"}
      </p>
      <div className="flex justify-end">
        <ReasonDialog
          trigger={<Button size="sm" disabled={!ok}><Save className="h-4 w-4 mr-1" /> Salvează</Button>}
          title="Salvează discover.score_weights"
          confirmLabel="Salvează"
          onConfirm={(r) => onSave(v, r)}
        />
      </div>
    </div>
  );
}

function ScalarForm({ row, onSave, type }: { row: Setting; onSave: (val: any, reason: string) => Promise<void>; type: "number" | "text" }) {
  const [v, setV] = useState<any>(row.value ?? (type === "number" ? 0 : ""));
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Label className="text-xs">{row.key}</Label>
        {type === "number"
          ? <Input type="number" value={v} onChange={(e) => setV(Number(e.target.value))} className="mt-1" />
          : <Input type="text" value={v} onChange={(e) => setV(e.target.value)} className="mt-1" />}
      </div>
      <ReasonDialog
        trigger={<Button size="sm"><Save className="h-4 w-4 mr-1" /> Salvează</Button>}
        title={`Salvează ${row.key}`}
        confirmLabel="Salvează"
        onConfirm={(r) => onSave(v, r)}
      />
    </div>
  );
}

function JsonFallbackForm({ row, onSave }: { row: Setting; onSave: (val: any, reason: string) => Promise<void> }) {
  const [text, setText] = useState(JSON.stringify(row.value ?? null, null, 2));
  const [err, setErr] = useState<string | null>(null);
  function parse() {
    try { return JSON.parse(text); } catch (e) {
      setErr(String((e as Error).message));
      return undefined;
    }
  }
  return (
    <div className="space-y-2">
      <Textarea rows={10} value={text} onChange={(e) => { setText(e.target.value); setErr(null); }}
        className="font-mono text-xs" />
      {err && <p className="text-xs text-red-400">JSON invalid: {err}</p>}
      <div className="flex justify-end">
        <ReasonDialog
          trigger={<Button size="sm" variant="outline"><Save className="h-4 w-4 mr-1" /> Salvează JSON</Button>}
          title={`Salvează ${row.key} (JSON brut)`}
          confirmLabel="Salvează"
          onConfirm={async (r) => {
            const val = parse();
            if (val === undefined) throw new Error("JSON invalid — nu pot salva");
            await onSave(val, r);
          }}
        />
      </div>
    </div>
  );
}

/* ===================== HISTORY ===================== */
function HistoryButton({ keyName }: { keyName: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(adminSettingHistory);
  async function load() {
    setBusy(true);
    try {
      const r = await fn({ data: { key: keyName } });
      setRows(r.rows);
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setBusy(false); }
  }
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => { setOpen((o) => !o); if (!rows) load(); }}>
        <History className="h-4 w-4 mr-1" /> Istoric
      </Button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-background/40 p-2 text-xs">
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          {rows && rows.length === 0 && <p className="text-muted-foreground">Fără modificări înregistrate.</p>}
          {rows && rows.map((h) => (
            <div key={h.version} className="border-b border-border/30 py-1">
              <span className="text-muted-foreground">v{h.version} · {new Date(h.changed_at ?? h.created_at).toLocaleString()}</span>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] opacity-80">{JSON.stringify(h.value, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ===================== MAIN PANEL ===================== */
export function SettingsAndFlagsPanel() {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [flags, setFlags] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const list = useServerFn(adminListSettings);
  const listF = useServerFn(adminListFlags);
  const upd = useServerFn(adminUpdateSetting);
  const updF = useServerFn(adminUpsertFlag);

  async function reload() {
    setLoading(true); setError(null);
    try {
      const [s, f] = await Promise.all([list(), listF()]);
      setSettings(s.rows as Setting[]);
      setFlags(f.rows);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  async function save(key: string, value: any, reason: string) {
    await upd({ data: { key, value, justification: reason } });
    toast.success(`Salvat ${key}`);
    reload();
  }
  async function saveFlag(key: string, patch: Record<string, any>, reason: string) {
    await updF({ data: { key, ...patch, justification: reason } });
    toast.success(`Salvat flag ${key}`);
    reload();
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (error) return <ErrorBanner error={error} onRetry={reload} />;

  const byKey = new Map((settings ?? []).map((s) => [s.key, s]));

  function renderSetting(row: Setting) {
    const onSave = (v: any, r: string) => save(row.key, v, r);
    if (row.key === "proximity_notifications") return <ProximityForm row={row} onSave={onSave} />;
    if (row.key === "partner_quotas")          return <QuotasForm row={row} onSave={onSave} />;
    if (row.key === "discover.score_weights")  return <ScoreWeightsForm row={row} onSave={onSave} />;
    if (typeof row.value === "number")         return <ScalarForm row={row} onSave={onSave} type="number" />;
    if (typeof row.value === "string")         return <ScalarForm row={row} onSave={onSave} type="text" />;
    return <JsonFallbackForm row={row} onSave={onSave} />;
  }

  // categorii cu prioritate sus.
  const order = ["notifications", "general", "matching", "limits", "gdpr", "system"];
  const sortedSettings = [...(settings ?? [])].sort((a, b) => {
    const ai = order.indexOf(a.category ?? "");
    const bi = order.indexOf(b.category ?? "");
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.key.localeCompare(b.key);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">App settings &amp; feature flags</h2>
        <Button onClick={reload} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5 mr-1" /> Reload</Button>
      </div>

      {/* SETTINGS */}
      <div className="space-y-3">
        {sortedSettings.length === 0
          ? <p className="text-sm text-muted-foreground">Niciun setting (empty legitim).</p>
          : sortedSettings.map((row) => (
            <Card key={row.key} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono">{row.key}</code>
                    {row.category && <Badge variant="outline" className="text-[10px]">{row.category}</Badge>}
                    <span className="text-[10px] text-muted-foreground">v{row.version ?? 1}</span>
                  </div>
                  {row.description && <p className="text-xs text-muted-foreground mt-1">{row.description}</p>}
                </div>
                <HistoryButton keyName={row.key} />
              </div>
              <div className="mt-3">{renderSetting(row)}</div>
              {/* Fallback JSON colapsabil oricând */}
              {!["proximity_notifications", "partner_quotas", "discover.score_weights"].includes(row.key)
                && typeof row.value !== "number" && typeof row.value !== "string" && null}
              {["proximity_notifications", "partner_quotas", "discover.score_weights"].includes(row.key) && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Edit JSON brut</summary>
                  <div className="mt-2"><JsonFallbackForm row={row} onSave={(v, r) => save(row.key, v, r)} /></div>
                </details>
              )}
            </Card>
          ))}
      </div>

      {/* FLAGS */}
      <h2 className="text-lg font-semibold pt-4">Feature flags</h2>
      <div className="space-y-2">
        {(flags ?? []).length === 0 && <p className="text-sm text-muted-foreground">Niciun feature flag (empty legitim).</p>}
        {(flags ?? []).map((f) => (
          <Card key={f.key} className="p-3 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono">{f.key}</code>
                {f.enabled
                  ? <Badge className="bg-emerald-500/20 text-emerald-300">ON</Badge>
                  : <Badge variant="outline" className="text-muted-foreground">OFF</Badge>}
                <span className="text-[10px] text-muted-foreground">rollout {f.rollout_pct ?? 0}%</span>
              </div>
              {f.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              <ReasonDialog
                trigger={
                  <Button size="sm" variant={f.enabled ? "outline" : "default"}>
                    {f.enabled ? <ToggleLeft className="h-4 w-4 mr-1" /> : <ToggleRight className="h-4 w-4 mr-1" />}
                    {f.enabled ? "Dezactivează" : "Activează"}
                  </Button>
                }
                title={`${f.enabled ? "Dezactivează" : "Activează"} ${f.key}`}
                destructive={f.enabled}
                confirmLabel={f.enabled ? "Dezactivează" : "Activează"}
                onConfirm={(r) => saveFlag(f.key, { enabled: !f.enabled }, r)}
              />
              <RolloutEditor flag={f} onSave={(pct, r) => saveFlag(f.key, { rollout_pct: pct }, r)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RolloutEditor({ flag, onSave }: { flag: any; onSave: (pct: number, reason: string) => Promise<void> }) {
  const [pct, setPct] = useState<number>(flag.rollout_pct ?? 0);
  return (
    <ReasonDialog
      trigger={<Button size="sm" variant="ghost">Rollout</Button>}
      title={`Setează rollout pentru ${flag.key}`}
      confirmLabel="Salvează"
      fields={
        <div>
          <Label>Rollout (%)</Label>
          <Input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
        </div>
      }
      onConfirm={(r) => onSave(pct, r)}
    />
  );
}
