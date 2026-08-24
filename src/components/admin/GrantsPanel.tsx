/**
 * Panou „Acordări & compensații" — un singur ecran de unde staff-ul poate
 * oferi: Premium, credit wallet, XP, insigne, Boost, plan partener,
 * discount pe factură. Fiecare acordare cere motiv (min. 5 caractere),
 * trece prin RPC gated pe admin/super_admin + MFA, și se loghează.
 *
 * Stări: loading / error / empty legitim (regula ADMIN PANELS).
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gift, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminErrorBanner } from "@/components/admin/AdminErrorBanner";
import {
  adminGrantCatalog,
  adminGrantPerk,
  adminListGrants,
} from "@/lib/admin-grants.functions";

type GrantRow = Record<string, any>;

const KIND_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "premium_days", label: "Premium gratuit (zile)", hint: "Extinde sau creează un abonament de compensare." },
  { value: "wallet_credit", label: "Credit portofel (USD)", hint: "Suma se adaugă în portofelul disponibil." },
  { value: "xp", label: "XP", hint: "Puncte de experiență pentru misiuni/concursuri." },
  { value: "badge", label: "Insignă", hint: "Insignă manuală din catalog (opțional cu expirare)." },
  { value: "boost_days", label: "Boost (zile)", hint: "Vizibilitate crescută în Discover." },
  { value: "boosts_balance", label: "Boosturi în cont (buc.)", hint: "Boosturi pe care userul le folosește când vrea." },
  { value: "partner_plan_days", label: "Plan partener gratuit (zile)", hint: "Activează sau extinde planul B2B." },
  { value: "invoice_discount", label: "Discount pe factură (%)", hint: "Doar facturi partener neplătite." },
];

function fmtDetail(g: GrantRow) {
  switch (g.kind) {
    case "premium_days":
    case "boost_days":
    case "partner_plan_days":
      return `${g.days} zile${g.code ? ` · ${g.code}` : ""}`;
    case "wallet_credit":
      return `$${((g.amount_cents ?? 0) / 100).toFixed(2)}`;
    case "boosts_balance":
      return `${g.amount_cents} boosturi`;
    case "xp":
      return `${g.xp} XP`;
    case "badge":
      return g.code ?? "-";
    case "invoice_discount":
      return `${g.meta?.percent ?? "?"}%`;
    default:
      return "-";
  }
}

export function GrantsPanel() {
  const grant = useServerFn(adminGrantPerk);
  const list = useServerFn(adminListGrants);
  const catalog = useServerFn(adminGrantCatalog);

  const [rows, setRows] = useState<GrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Array<{ code: string; name: string | null }>>([]);
  const [badges, setBadges] = useState<Array<{ code: string }>>([]);

  const [userId, setUserId] = useState("");
  const [kind, setKind] = useState("premium_days");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("30");
  const [amount, setAmount] = useState("5");
  const [xp, setXp] = useState("100");
  const [code, setCode] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [percent, setPercent] = useState("50");
  const [busy, setBusy] = useState(false);

  const kindMeta = useMemo(() => KIND_OPTIONS.find((k) => k.value === kind), [kind]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [g, c] = await Promise.all([list({ data: {} }), catalog({})]);
      setRows(g.grants);
      setPlans(c.plans);
      setBadges(c.badges);
    } catch (e: any) {
      setError(e?.message ?? "Eroare necunoscută");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!userId.trim()) {
      toast.error("Completează ID-ul utilizatorului.");
      return;
    }
    if (reason.trim().length < 5) {
      toast.error("Motivul este obligatoriu (min. 5 caractere) — se scrie în audit.");
      return;
    }
    setBusy(true);
    try {
      await grant({
        data: {
          userId: userId.trim(),
          kind: kind as any,
          reason: reason.trim(),
          days: ["premium_days", "boost_days", "partner_plan_days", "badge"].includes(kind)
            ? Number(days) || null
            : null,
          amountCents:
            kind === "wallet_credit"
              ? Math.round((Number(amount) || 0) * 100)
              : kind === "boosts_balance"
                ? Number(amount) || null
                : null,
          xp: kind === "xp" ? Number(xp) || null : null,
          code: ["badge", "partner_plan_days"].includes(kind) ? code || null : null,
          invoiceId: kind === "invoice_discount" ? invoiceId.trim() || null : null,
          percent: kind === "invoice_discount" ? Number(percent) || null : null,
        },
      });
      toast.success("Acordare efectuată și înregistrată în audit.");
      setReason("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Acordarea a eșuat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Gift className="h-5 w-5" /> Acordări &amp; compensații
        </h2>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reîncarcă
        </Button>
      </div>

      {error && (
        <AdminErrorBanner
          error={error}
          onRetry={() => void load()}
          forbiddenHint="Ai nevoie de rol admin/super_admin și MFA înrolat."
        />
      )}

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>ID utilizator (UUID)</Label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-…" />
          </div>
          <div className="space-y-1.5">
            <Label>Ce oferi</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {kindMeta && <p className="text-xs text-muted-foreground">{kindMeta.hint}</p>}
          </div>

          {["premium_days", "boost_days", "partner_plan_days"].includes(kind) && (
            <div className="space-y-1.5">
              <Label>Zile</Label>
              <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
          )}

          {kind === "wallet_credit" && (
            <div className="space-y-1.5">
              <Label>Sumă (USD)</Label>
              <Input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}

          {kind === "boosts_balance" && (
            <div className="space-y-1.5">
              <Label>Număr de boosturi</Label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}

          {kind === "xp" && (
            <div className="space-y-1.5">
              <Label>XP</Label>
              <Input type="number" min={1} value={xp} onChange={(e) => setXp(e.target.value)} />
            </div>
          )}

          {kind === "badge" && (
            <>
              <div className="space-y-1.5">
                <Label>Insignă</Label>
                <Select value={code} onValueChange={setCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alege insigna" />
                  </SelectTrigger>
                  <SelectContent>
                    {badges.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expiră după (zile, 0 = permanent)</Label>
                <Input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
            </>
          )}

          {kind === "partner_plan_days" && (
            <div className="space-y-1.5">
              <Label>Plan partener</Label>
              <Select value={code} onValueChange={setCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege planul" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name ?? p.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "invoice_discount" && (
            <>
              <div className="space-y-1.5">
                <Label>ID factură</Label>
                <Input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="UUID factură" />
              </div>
              <div className="space-y-1.5">
                <Label>Discount (%)</Label>
                <Input type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Motiv (obligatoriu, ajunge în audit)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Ex: compensație pentru bug la plată #1234"
          />
        </div>

        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
          Acordă
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2 text-sm font-medium">Istoric acordări</div>
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Empty legitim: nu a fost acordat încă nimic.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                <span className="font-medium">{g.kind}</span>
                <span className="text-muted-foreground">{fmtDetail(g)}</span>
                <span className="text-muted-foreground">
                  → {g.target_name ?? g.target_user_id?.slice(0, 8)}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {g.actor_name ?? "staff"} · {new Date(g.created_at).toLocaleString("ro-RO")}
                </span>
                {g.reason && <span className="w-full text-xs text-muted-foreground">„{g.reason}"</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
