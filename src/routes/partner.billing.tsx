/**
 * Partener → /partner/billing
 * - Plan curent + entitlements
 * - Date fiscale (IBAN, billing email, vat payer)
 * - Listă facturi + modal cu instrucțiuni OP
 * - Upgrade plan → creează factură proformă pending_payment
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  partnerListPlans,
  partnerGetMySubscription,
  partnerListMyInvoices,
  partnerStartSubscription,
  partnerUpdateBillingProfile,
} from "@/lib/billing.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Copy, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { StatusNotificationsBell } from "@/components/partner/StatusNotificationsBell";


export const Route = createFileRoute("/partner/billing")({
  head: () => ({ meta: [{ title: "Facturare — Ventuza Partners" }, { name: "robots", content: "noindex" }] }),
  component: PartnerBilling,
});

const RON = (m: number | null | undefined) =>
  ((m ?? 0) / 100).toLocaleString("ro-RO", { style: "currency", currency: "RON" });

function PartnerBilling() {
  const { user } = useAuth();
  const getPlans = useServerFn(partnerListPlans);
  const getSub = useServerFn(partnerGetMySubscription);
  const getInvoices = useServerFn(partnerListMyInvoices);
  const start = useServerFn(partnerStartSubscription);
  const updateBilling = useServerFn(partnerUpdateBillingProfile);

  const [plans, setPlans] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [sub, setSub] = useState<any>(null);
  const [ent, setEnt] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bizApp, setBizApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opInvoice, setOpInvoice] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, s, i] = await Promise.all([getPlans({}), getSub({}), getInvoices({})]);
      setPlans(p.plans); setSettings(p.settings);
      setSub(s.subscription); setEnt(s.entitlements);
      setInvoices(i.invoices);
      const { data: ba } = await supabase.from("business_applications")
        .select("brand_name,legal_name,cui,iban,billing_email,is_vat_payer,billing_completed_at,status")
        .eq("user_id", user!.id).eq("status", "approved")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      setBizApp(ba);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [getPlans, getSub, getInvoices, user]);
  useEffect(() => {
    if (user) load();
    // Auth guard: dacă nu e user după ce auth s-a încărcat → nu mai sta în spinner.
    else setLoading(false);
  }, [load, user]);

  // Polling 30s pe facturi cât există plăți pending — toast la activare.
  useEffect(() => {
    const hasPending = invoices.some((i) => i.status === "pending_payment" || i.status === "overdue");
    if (!hasPending || !user) return;
    const id = setInterval(async () => {
      try {
        const fresh = await getInvoices({});
        const prev = new Map(invoices.map((i) => [i.id, i.status]));
        for (const inv of fresh.invoices) {
          const before = prev.get(inv.id);
          if (before && before !== "paid" && inv.status === "paid") {
            toast.success(`Factura ${inv.payment_code} a fost confirmată. Abonamentul tău e activ.`);
          }
        }
        setInvoices(fresh.invoices);
        // Reîncarcă și subscription dacă s-a activat ceva.
        if (fresh.invoices.some((i: any) => i.status === "paid" && (prev.get(i.id) ?? "") !== "paid")) {
          const s = await getSub({});
          setSub(s.subscription); setEnt(s.entitlements);
        }
      } catch { /* silently retry */ }
    }, 30000);
    return () => clearInterval(id);
  }, [invoices, user, getInvoices, getSub]);

  const startUpgrade = async (planCode: "Pro" | "Premium") => {
    try {
      const r = await start({ data: { plan_code: planCode } });
      toast.success("Factură proformă generată. Vezi instrucțiunile OP.");
      setOpInvoice(r.invoice);
      load();
    } catch (e: any) { toast.error(e.message.replace(/^Error: /, "")); }
  };

  if (!user) return (
    <div className="container max-w-md py-12 text-center space-y-3">
      <h1 className="text-xl font-semibold">Facturare partener</h1>
      <p className="text-sm text-muted-foreground">Conectează-te ca să vezi planul și facturile.</p>
      <Button asChild><Link to="/auth" search={{ mode: "login" }}>Conectează-te</Link></Button>
    </div>
  );
  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (error) return (
    <div className="container max-w-4xl py-6">
      <div className="p-4 bg-destructive/10 text-destructive rounded">{error}</div>
      <Button onClick={load} className="mt-2">Reîncearcă</Button>
    </div>
  );

  const billingComplete = !!bizApp?.billing_completed_at && !!bizApp?.billing_email;
  const issuer = settings?.issuer;
  const issuerOK = issuer?.iban && issuer?.cui;

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/partner"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Înapoi</Button></Link>
          <h1 className="text-2xl font-bold">Facturare</h1>
        </div>
        <StatusNotificationsBell />
      </div>


      {!issuerOK && (
        <div className="p-3 rounded bg-yellow-50 dark:bg-yellow-950/30 text-sm">
          ⚠️ Emitentul nu este complet configurat. Contactează administratorul.
        </div>
      )}

      {/* Plan curent */}
      <div className="rounded-lg border p-4 space-y-2">
        <div className="text-xs text-muted-foreground uppercase">Plan curent</div>
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold">{sub?.plan_code ?? "Free"}</div>
          <span className={`text-xs px-2 py-1 rounded ${sub?.status === "active" ? "bg-green-100 text-green-700" : sub?.status === "grace" ? "bg-yellow-100 text-yellow-700" : "bg-muted"}`}>
            {sub?.status ?? "—"}
          </span>
          {sub?.current_period_end && (
            <span className="text-sm text-muted-foreground">
              valabil până {new Date(sub.current_period_end).toLocaleDateString("ro-RO")}
            </span>
          )}
        </div>
        {ent && (
          <div className="text-xs text-muted-foreground">
            Max venues: {ent.max_venues} · Events: {ent.max_events} · Push: {ent.push_priority}
            {ent.featured_in_nearby && " · ★ Featured"} {ent.badge_verified && " · ✓ Badge verificat"}
          </div>
        )}
      </div>

      {/* Date fiscale — key forțează remount când bizApp ajunge async */}
      <BillingProfileCard key={bizApp?.user_id ?? bizApp?.cui ?? "empty"} biz={bizApp} onSave={async (vals) => {
        try { await updateBilling({ data: vals }); toast.success("Date fiscale actualizate"); load(); }
        catch (e: any) { toast.error(e.message); }
      }} />

      {/* Planuri disponibile */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Schimbă plan</h2>
        {!billingComplete && (
          <div className="p-3 mb-3 rounded bg-yellow-50 dark:bg-yellow-950/30 text-sm">
            Completează datele de facturare înainte de upgrade.
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-3">
          {plans.map((p) => {
            const price = settings?.prices?.[p.code]?.monthly_minor;
            const isCurrent = sub?.plan_code === p.code && sub?.status !== "free_downgraded";
            return (
              <div key={p.code} className={`rounded-lg border p-4 ${isCurrent ? "border-primary" : ""}`}>
                <div className="text-lg font-bold">{p.name}</div>
                <div className="text-sm text-muted-foreground min-h-[40px]">{p.description}</div>
                <div className="my-3 text-2xl font-bold">
                  {p.code === "Free" ? "Gratuit" : `${RON(price)} /lună`}
                  {p.code !== "Free" && <span className="text-xs text-muted-foreground"> + TVA</span>}
                </div>
                <ul className="text-xs space-y-1 mb-3">
                  <li>• {p.entitlements.max_venues} venues</li>
                  <li>• {p.entitlements.max_events} events</li>
                  <li>• Push: {p.entitlements.push_priority}</li>
                  {p.entitlements.featured_in_nearby && <li>• Featured în Nearby</li>}
                  {p.entitlements.can_create_boost && <li>• Boost evenimente 48h</li>}
                </ul>
                {p.code !== "Free" && (
                  isCurrent ? <Button disabled className="w-full">Plan activ</Button>
                  : <Button className="w-full" disabled={!billingComplete} onClick={() => startUpgrade(p.code as any)}>
                      {sub?.plan_code === "Free" ? "Abonare" : "Schimbă"}
                    </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Facturi */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Facturile mele</h2>
        {invoices.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 rounded border">Nicio factură încă.</div>
        ) : (
          <div className="rounded border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr><th className="p-2 text-left">Cod</th><th className="p-2">Tip</th><th className="p-2 text-right">Total</th><th className="p-2">Status</th><th className="p-2">Emisă</th><th className="p-2">Scadență</th><th></th></tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-2 font-mono text-xs">{inv.payment_code}</td>
                    <td className="p-2">{inv.kind}</td>
                    <td className="p-2 text-right">{RON(inv.total_minor)}</td>
                    <td className="p-2">{inv.status}</td>
                    <td className="p-2 text-xs">{new Date(inv.issued_at).toLocaleDateString("ro-RO")}</td>
                    <td className="p-2 text-xs">{new Date(inv.due_at).toLocaleDateString("ro-RO")}</td>
                    <td className="p-2">
                      {(inv.status === "pending_payment" || inv.status === "overdue") && (
                        <Button size="sm" variant="outline" onClick={() => setOpInvoice(inv)}>Instrucțiuni OP</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal instrucțiuni OP */}
      {opInvoice && (
        <Dialog open onOpenChange={() => setOpInvoice(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Instrucțiuni transfer bancar</DialogTitle>
              <DialogDescription>Fă ordinul de plată cu datele de mai jos. Abonamentul se activează în 1–3 zile lucrătoare după confirmare.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="rounded border p-3 bg-muted/30 space-y-1">
                <div><span className="text-muted-foreground">Beneficiar:</span> <strong>{opInvoice.issuer_snapshot?.name}</strong></div>
                <div><span className="text-muted-foreground">CUI:</span> {opInvoice.issuer_snapshot?.cui}</div>
                <div><span className="text-muted-foreground">Banca:</span> {opInvoice.issuer_snapshot?.bank}</div>
                <div><span className="text-muted-foreground">IBAN:</span> <span className="font-mono">{opInvoice.issuer_snapshot?.iban}</span></div>
                <div><span className="text-muted-foreground">Sumă:</span> <strong>{RON(opInvoice.total_minor)}</strong> (incl. TVA)</div>
              </div>
              <div className="rounded border-2 border-primary p-3">
                <div className="text-xs text-muted-foreground mb-1">DETALII PLATĂ (mențiune OP) — OBLIGATORIU:</div>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-bold flex-1">{opInvoice.payment_code}</code>
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(opInvoice.payment_code);
                    setCopied(true); setTimeout(() => setCopied(false), 2000);
                  }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Fără acest cod nu putem identifica plata.</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Scadență: {new Date(opInvoice.due_at).toLocaleDateString("ro-RO")}
              </div>
            </div>
            <DialogFooter><Button onClick={() => setOpInvoice(null)}>Am înțeles</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function BillingProfileCard({ biz, onSave }: { biz: any; onSave: (v: { iban: string | null; billing_email: string; is_vat_payer: boolean }) => void }) {
  const [iban, setIban] = useState(biz?.iban ?? "");
  const [email, setEmail] = useState(biz?.billing_email ?? "");
  const [vat, setVat] = useState<boolean>(!!biz?.is_vat_payer);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="text-xs text-muted-foreground uppercase">Date fiscale</div>
      <div className="text-sm">
        <strong>{biz?.legal_name ?? "—"}</strong> · CUI {biz?.cui ?? "—"}
      </div>
      <div className="grid md:grid-cols-3 gap-2">
        <div><Label>Email facturare *</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
        <div><Label>IBAN (opțional)</Label><Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="ROxx XXXX …" /></div>
        <div className="flex items-end gap-2"><input type="checkbox" id="vat" checked={vat} onChange={(e) => setVat(e.target.checked)} /><Label htmlFor="vat">Plătitor TVA</Label></div>
      </div>
      <Button onClick={() => onSave({ iban: iban || null, billing_email: email, is_vat_payer: vat })}>Salvează</Button>
    </div>
  );
}
