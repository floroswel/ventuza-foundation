/**
 * Admin → Facturare parteneri.
 * - InvoicesPanel: listă facturi cu acțiuni inline (confirmă/anulează/PDF).
 * - RevenuePanel: KPI venituri lună + restanțe + parteneri per plan.
 * - BillingSettingsPanel: editor emitent + prețuri (admin+).
 *
 * AGENTS.md — REGULĂ ADMIN PANELS: loading/error/empty distincte; spinner infinit interzis.
 */
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListInvoices,
  adminConfirmInvoicePayment,
  adminCancelInvoice,
  adminRevenueSummary,
  adminGetBillingSettings,
  adminUpdateBillingSettings,
  adminRunBillingTick,
} from "@/lib/billing-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, FileText, RefreshCw } from "lucide-react";
import {
  GlassCard,
  MonoNumber,
  Kpi,
  StatusBadge,
  SectionTitle,
} from "@/components/admin/ui/primitives";

const RON = (minor: number | null | undefined) =>
  ((minor ?? 0) / 100).toLocaleString("ro-RO", { style: "currency", currency: "RON" });

type Invoice = {
  id: string;
  owner_id: string;
  series: string;
  number: number;
  year: number;
  payment_code: string;
  kind: string;
  plan_code: string | null;
  total_minor: number;
  subtotal_minor: number;
  vat_minor: number;
  status: string;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  paid_ref: string | null;
  billing_snapshot: any;
  issuer_snapshot: any;
};

export function InvoicesPanel() {
  const list = useServerFn(adminListInvoices);
  const cancel = useServerFn(adminCancelInvoice);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await list({
        data: { status: filterStatus || undefined, search: search || undefined, limit: 200 },
      });
      setRows(r.invoices as Invoice[]);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [list, filterStatus, search]);
  useEffect(() => {
    load();
  }, [load]);

  const onCancel = async (inv: Invoice) => {
    const reason = prompt("Motiv anulare:");
    if (!reason || reason.length < 3) return;
    try {
      await cancel({ data: { invoice_id: inv.id, reason } });
      toast.success("Factură anulată");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (error)
    return (
      <div className="p-4 rounded bg-destructive/10 text-destructive">
        <div>Eroare: {error}</div>
        <Button size="sm" variant="outline" onClick={load} className="mt-2">
          Reîncearcă
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <Label className="text-xs">Status</Label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 px-2 rounded border bg-background text-sm"
          >
            <option value="">Toate</option>
            <option value="pending_payment">În așteptare plată</option>
            <option value="overdue">Restante</option>
            <option value="paid">Plătite</option>
            <option value="cancelled">Anulate</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Caută cod plată / OP ref</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="VTZ-2026-…"
          />
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <GlassCard>
          <div className="p-6 text-sm text-muted-foreground">Nicio factură (empty legitim).</div>
        </GlassCard>
      ) : (
        <div className="rounded border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-2">Cod plată</th>
                <th className="p-2">Tip</th>
                <th className="p-2">Plan</th>
                <th className="p-2">Partener (CUI)</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2">Status</th>
                <th className="p-2">Emisă</th>
                <th className="p-2">Scadență</th>
                <th className="p-2">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-mono text-xs">{inv.payment_code}</td>
                  <td className="p-2">{inv.kind}</td>
                  <td className="p-2">{inv.plan_code ?? "—"}</td>
                  <td className="p-2 text-xs">
                    {inv.billing_snapshot?.legal_name ?? "?"}
                    <br />
                    <span className="text-muted-foreground">
                      CUI {inv.billing_snapshot?.cui ?? "?"}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <MonoNumber value={RON(inv.total_minor)} />
                  </td>
                  <td className="p-2">
                    <StatusBadge
                      tone={
                        inv.status === "paid"
                          ? "approved"
                          : inv.status === "overdue"
                            ? "rejected"
                            : inv.status === "cancelled"
                              ? "neutral"
                              : "pending"
                      }
                    >
                      {inv.status}
                    </StatusBadge>
                  </td>
                  <td className="p-2 text-xs">
                    {new Date(inv.issued_at).toLocaleDateString("ro-RO")}
                  </td>
                  <td className="p-2 text-xs">
                    {new Date(inv.due_at).toLocaleDateString("ro-RO")}
                  </td>
                  <td className="p-2 flex gap-1">
                    {(inv.status === "pending_payment" || inv.status === "overdue") && (
                      <>
                        <Button size="sm" onClick={() => setSelected(inv)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Confirmă
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onCancel(inv)}>
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setSelected(inv)}>
                      <FileText className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <InvoiceDrawer invoice={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
}

function InvoiceDrawer({
  invoice,
  onClose,
  onChanged,
}: {
  invoice: Invoice;
  onClose: () => void;
  onChanged: () => void;
}) {
  const confirm = useServerFn(adminConfirmInvoicePayment);
  const [amount, setAmount] = useState((invoice.total_minor / 100).toFixed(2));
  const [paidRef, setPaidRef] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const canConfirm = invoice.status === "pending_payment" || invoice.status === "overdue";

  const onConfirm = async () => {
    setBusy(true);
    try {
      const minor = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      await confirm({
        data: {
          invoice_id: invoice.id,
          amount_minor: minor,
          paid_ref: paidRef,
          paid_at: new Date(paidAt).toISOString(),
        },
      });
      toast.success("Plată confirmată. Abonament activat.");
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Factură {invoice.payment_code}</DialogTitle>
          <DialogDescription>
            Tip: {invoice.kind} · Plan: {invoice.plan_code ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <GlassCard>
              <div className="p-3">
                <div className="text-xs text-muted-foreground mb-1">EMITENT</div>
                <div className="font-medium">{invoice.issuer_snapshot?.name}</div>
                <div className="text-xs">
                  CUI {invoice.issuer_snapshot?.cui} · {invoice.issuer_snapshot?.reg_com}
                </div>
                <div className="text-xs">{invoice.issuer_snapshot?.address}</div>
                <div className="text-xs font-mono mt-1">{invoice.issuer_snapshot?.iban}</div>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="p-3">
                <div className="text-xs text-muted-foreground mb-1">PARTENER</div>
                <div className="font-medium">{invoice.billing_snapshot?.legal_name}</div>
                <div className="text-xs">
                  CUI {invoice.billing_snapshot?.cui} · {invoice.billing_snapshot?.reg_com}
                </div>
                <div className="text-xs">{invoice.billing_snapshot?.address}</div>
                <div className="text-xs">{invoice.billing_snapshot?.billing_email}</div>
              </div>
            </GlassCard>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              Subtotal: <MonoNumber value={RON(invoice.subtotal_minor)} />
            </div>
            <div>
              TVA: <MonoNumber value={RON(invoice.vat_minor)} />
            </div>
            <div className="font-bold">
              Total: <MonoNumber value={RON(invoice.total_minor)} />
            </div>
          </div>
          {invoice.status === "paid" && (
            <div className="rounded bg-green-50 dark:bg-green-950/30 p-3 text-sm">
              ✓ Plătită {invoice.paid_at && new Date(invoice.paid_at).toLocaleDateString("ro-RO")} ·
              Ref: {invoice.paid_ref}
            </div>
          )}
          {canConfirm && (
            <div className="border rounded p-3 space-y-2">
              <SectionTitle>Confirmă plată primită</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Sumă încasată (RON)</Label>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Referință OP</Label>
                  <Input
                    value={paidRef}
                    onChange={(e) => setPaidRef(e.target.value)}
                    placeholder="ex: nr. extras / OP"
                  />
                </div>
                <div>
                  <Label>Data încasării</Label>
                  <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </div>
              </div>
              <Button onClick={onConfirm} disabled={busy || !paidRef}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmă & activează"}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Închide
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RevenuePanel() {
  const summary = useServerFn(adminRevenueSummary);
  const tick = useServerFn(adminRunBillingTick);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await summary({}));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [summary]);
  useEffect(() => {
    load();
  }, [load]);

  const runTick = async () => {
    try {
      const r = await tick({});
      toast.success(
        `Tick: gen ${r.result.generated} · overdue ${r.result.overdue} · downgraded ${r.result.downgraded}`,
      );
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (error)
    return (
      <div className="p-4 text-destructive">
        Eroare: {error}{" "}
        <Button size="sm" onClick={load}>
          Reîncearcă
        </Button>
      </div>
    );
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Încasat (lună)" value={RON(data.paid_month_minor)} />
        <Kpi
          label="În așteptare"
          value={`${data.pending_count} · ${RON(data.pending_minor)}`}
          tone={data.pending_count > 0 ? "warn" : "default"}
        />
        <Kpi
          label="Restante"
          value={`${data.overdue_count} · ${RON(data.overdue_minor)}`}
          tone={data.overdue_count > 0 ? "danger" : "default"}
        />
        <Kpi
          label="Parteneri activi"
          value={Object.values<number>(data.partners_by_plan).reduce((a, b) => a + b, 0)}
        />
      </div>
      <GlassCard>
        <div className="p-4">
          <SectionTitle>Parteneri per plan</SectionTitle>
          <div className="mt-2 flex gap-4 text-sm">
            {["Free", "Pro", "Premium"].map((p) => (
              <div key={p} className="flex flex-col">
                <span className="text-muted-foreground text-xs">{p}</span>
                <MonoNumber value={data.partners_by_plan[p] ?? 0} />
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
      <div>
        <Button variant="outline" onClick={runTick}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Rulează billing-tick manual
        </Button>
      </div>
    </div>
  );
}

export function BillingSettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const get = useServerFn(adminGetBillingSettings);
  const upd = useServerFn(adminUpdateBillingSettings);
  const [val, setVal] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await get({});
        setVal(JSON.stringify(r.settings, null, 2));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [get]);

  const save = async () => {
    setBusy(true);
    try {
      const parsed = JSON.parse(val);
      await upd({ data: { value: parsed } });
      toast.success("Setări salvate");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader2 className="animate-spin" />;
  if (error) return <div className="p-4 text-destructive">{error}</div>;

  return (
    <div className="space-y-3">
      {!isAdmin && (
        <div className="p-3 rounded bg-yellow-50 dark:bg-yellow-950/30 text-sm">
          Doar admin/super_admin poate modifica setările.
        </div>
      )}
      <Textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        rows={22}
        className="font-mono text-xs"
        disabled={!isAdmin}
      />
      <Button onClick={save} disabled={!isAdmin || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvează (audit)"}
      </Button>
    </div>
  );
}

export function BillingAdminPanel({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<"invoices" | "revenue" | "settings">("invoices");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={tab === "invoices" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("invoices")}
        >
          Facturi
        </Button>
        <Button
          variant={tab === "revenue" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("revenue")}
        >
          Venituri
        </Button>
        <Button
          variant={tab === "settings" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("settings")}
        >
          Setări facturare
        </Button>
      </div>
      {tab === "invoices" && <InvoicesPanel />}
      {tab === "revenue" && <RevenuePanel />}
      {tab === "settings" && <BillingSettingsPanel isAdmin={isAdmin} />}
    </div>
  );
}
