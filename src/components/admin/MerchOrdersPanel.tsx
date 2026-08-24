import { useCallback, useEffect, useState } from "react";
import { Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminErrorBanner } from "./AdminErrorBanner";

// Tipurile generate nu includ încă RPC-urile de merch (migrare recentă).
const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type Order = {
  id: string;
  user_id: string;
  item: string;
  qty: number;
  total_cents: number;
  status: string;
  shipping: Record<string, string> | null;
  created_at: string;
};

const STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

export function MerchOrdersPanel() {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await db.rpc("admin_list_merch_orders", { _status: null });
    if (e) setError(e.message);
    else setRows((data ?? []) as unknown as Order[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const { error: e } = await db.rpc("admin_set_merch_order_status", {
      _id: id,
      _status: status,
      _note: null,
    });
    setBusy(null);
    if (e) toast.error(e.message);
    else {
      toast.success("Status actualizat");
      void load();
    }
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Package className="size-4" /> Comenzi merch
        </h2>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs"
        >
          <RefreshCw className="size-3.5" /> Reîncarcă
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nicio comandă (empty legitim).</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((o) => (
            <li key={o.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {o.item} × {o.qty}
                </span>
                <span className="text-xs text-muted-foreground">
                  ${(o.total_cents / 100).toFixed(2)} ·{" "}
                  {new Date(o.created_at).toLocaleDateString("ro-RO")}
                </span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">
                  {o.status}
                </span>
              </div>
              {o.shipping && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.shipping.name} · {o.shipping.address}, {o.shipping.city},{" "}
                  {o.shipping.country}
                  {o.shipping.phone ? ` · ${o.shipping.phone}` : ""}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {STATUSES.filter((s) => s !== o.status).map((s) => (
                  <button
                    key={s}
                    disabled={busy === o.id}
                    onClick={() => setStatus(o.id, s)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
