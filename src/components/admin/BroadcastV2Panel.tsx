import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard, Kpi, SectionTitle, StatusBadge } from "@/components/admin/ui/primitives";
import { broadcastPreview, broadcastSend, adminListCampaigns } from "@/lib/admin-broadcast.functions";

export function BroadcastV2Panel() {
  const preview = useServerFn(broadcastPreview);
  const send = useServerFn(broadcastSend);
  const listC = useServerFn(adminListCampaigns);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [channel] = useState<"inapp" | "push" | "both">("inapp");
  const [verified, setVerified] = useState<"any" | "yes" | "no">("any");
  const [minAgeDays, setMinAgeDays] = useState<string>("");
  const [maxAgeDays, setMaxAgeDays] = useState<string>("");
  const [city, setCity] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [dormant30d, setDormant30d] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const filter = () => ({
    ...(verified !== "any" ? { verified: verified === "yes" } : {}),
    ...(minAgeDays ? { minAgeDays: Number(minAgeDays) } : {}),
    ...(maxAgeDays ? { maxAgeDays: Number(maxAgeDays) } : {}),
    ...(city ? { city } : {}),
    ...(planCode ? { planCode } : {}),
    ...(dormant30d ? { hasNoActivity30d: true } : {}),
  });

  const doPreview = async () => {
    setBusy(true);
    try { const r = await preview({ data: { filter: filter() } }); setCount(r.count); }
    catch (e: any) { toast.error(e?.message ?? "Eroare"); } finally { setBusy(false); }
  };
  const loadCampaigns = async () => {
    try { setRows(await listC()); } catch (e: any) { toast.error(e?.message ?? "Eroare"); }
  };
  useEffect(() => { loadCampaigns(); }, []);

  const doSend = async () => {
    if (title.length < 3 || body.length < 3) { toast.error("Titlu / mesaj prea scurt."); return; }
    if (count === null) { toast.error("Fă preview mai întâi."); return; }
    if (!confirm(`Trimiți către ${count} utilizatori?`)) return;
    setBusy(true);
    try {
      const r = await send({ data: { title, body, link: link || undefined, channel, filter: filter() } });
      toast.success(`Trimis: ${r.delivered}/${r.target}`); loadCampaigns();
    } catch (e: any) { toast.error(e?.message ?? "Eroare"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <SectionTitle>Broadcast targeting</SectionTitle>
      <GlassCard>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Titlu</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Link opțional</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Mesaj</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000} className="mt-1" />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/60 bg-surface-elevated p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtre audiență</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-[11px]">Verificat</Label>
              <select value={verified} onChange={(e) => setVerified(e.target.value as any)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                <option value="any">Oricare</option><option value="yes">Da</option><option value="no">Nu</option>
              </select>
            </div>
            <div>
              <Label className="text-[11px]">Vechime min (zile)</Label>
              <Input type="number" value={minAgeDays} onChange={(e) => setMinAgeDays(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px]">Vechime max (zile)</Label>
              <Input type="number" value={maxAgeDays} onChange={(e) => setMaxAgeDays(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px]">Oraș</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px]">Plan code</Label>
              <Input value={planCode} onChange={(e) => setPlanCode(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={dormant30d} onChange={(e) => setDormant30d(e.target.checked)} />
                Inactivi &gt; 30 zile
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={doPreview} disabled={busy}>
            {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Eye className="mr-1 size-4" />} Preview audiență
          </Button>
          {count !== null && (
            <StatusBadge tone="approved">Estimare: {count.toLocaleString("ro-RO")} destinatari</StatusBadge>
          )}
          <Button onClick={doSend} disabled={busy || count === null || count === 0}>
            <Send className="mr-1 size-4" /> Trimite acum
          </Button>
        </div>
      </GlassCard>

      <SectionTitle>Campanii recente</SectionTitle>
      <GlassCard>
        {rows.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Fără campanii.</p>}
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr><th className="px-2 py-1 text-left">Când</th><th>Titlu</th><th>Status</th><th>Target</th><th>Delivered</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border/50">
                <td className="px-2 py-1">{new Date(c.created_at).toLocaleString("ro-RO")}</td>
                <td className="px-2 py-1">{c.title}</td>
                <td className="px-2 py-1 text-center">
                  <StatusBadge tone={c.status === "sent" ? "approved" : c.status === "sending" ? "pending" : "neutral"}>
                    {c.status}
                  </StatusBadge>
                </td>
                <td className="px-2 py-1 text-center">{c.target_count}</td>
                <td className="px-2 py-1 text-center">{c.delivered_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
