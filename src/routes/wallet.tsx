import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Wallet, Gift, Copy, Share2, Check, ShoppingBag, Clock } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { getMyReferralCode, referralLink } from "@/lib/referrals";
import { WalletQuests } from "@/components/wallet/WalletQuests";
import { AmbassadorLeaderboard } from "@/components/wallet/AmbassadorLeaderboard";
import {
  fetchWallet,
  fetchMerch,
  fetchMyOrders,
  placeMerchOrder,
  formatUsd,
  ledgerLabel,
  ORDER_ERRORS,
  type WalletState,
  type MerchItem,
  type MerchOrder,
  type Shipping,
  MIN_REDEEM_CENTS,
} from "@/lib/wallet";

export const Route = createFileRoute("/wallet")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Portofel Suzeta — invită și câștigă" },
      {
        name: "description",
        content:
          "Invită prieteni în Suzeta, primești dolari în portofel și îi folosești pentru produse cu logo Suzeta.",
      },
      { property: "og:title", content: "Portofel Suzeta — invită și câștigă" },
      {
        property: "og:description",
        content: "Recomandă Suzeta, adună dolari și comandă merch cu logo Suzeta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/wallet" }],
  }),
  component: WalletPage,
});

function WalletPage() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [items, setItems] = useState<MerchItem[]>([]);
  const [orders, setOrders] = useState<MerchOrder[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MerchItem | null>(null);

  async function reload() {
    const [w, o] = await Promise.all([fetchWallet(), fetchMyOrders()]);
    setWallet(w);
    setOrders(o);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const [w, m, o, c] = await Promise.all([
        fetchWallet(),
        fetchMerch(),
        fetchMyOrders(),
        getMyReferralCode(),
      ]);
      if (!alive) return;
      setWallet(w);
      setItems(m);
      setOrders(o);
      setCode(c);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const link = code ? referralLink(code) : "";

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Link copiat");
  }

  async function share() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Suzeta",
          text: "Hai pe Suzeta — primim amândoi credite în portofel",
          url: link,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await copy();
    }
  }

  return (
    <div className="min-h-dvh bg-background pb-nav">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Wallet className="size-4 text-primary" /> Portofel
        </h1>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-surface to-surface p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sold disponibil</p>
          <p className="mt-1 text-4xl font-semibold">
            {loading ? "…" : formatUsd(wallet?.balance_cents ?? 0)}
          </p>
          {(wallet?.pending_cents ?? 0) > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" /> {formatUsd(wallet!.pending_cents)} în așteptare — se
              deblochează după ce prietenul își verifică contul.
            </p>
          )}
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span>Invitații: {wallet?.referrals_total ?? 0}</span>
            <span>Confirmate: {wallet?.referrals_confirmed ?? 0}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <Gift className="size-5 text-primary" />
            <h2 className="text-base font-semibold">Invită și câștigă</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Fiecare prieten care intră cu linkul tău îți aduce $2.00, iar el primește $1.00. La 5,
            10 și 25 de invitații confirmate primești bonusuri suplimentare.
          </p>
          {code && (
            <div className="flex items-center gap-2 rounded-lg bg-background/80 p-2">
              <code className="flex-1 truncate font-mono text-xs">{link}</code>
              <button onClick={copy} className="rounded-md p-1.5 hover:bg-muted" aria-label="Copiază">
                {copied ? (
                  <Check className="size-4 text-primary" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
              <button onClick={share} className="rounded-md p-1.5 hover:bg-muted" aria-label="Share">
                <Share2 className="size-4" />
              </button>
            </div>
          )}
        </section>

        <WalletQuests onClaimed={reload} />

        <AmbassadorLeaderboard />

        <section>
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
            <ShoppingBag className="size-4 text-primary" /> Produse Suzeta
          </h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Comenzile se pot plasa de la un sold minim de {formatUsd(MIN_REDEEM_CENTS)}. Creditul
            nu se poate retrage în bani.{" "}
            <Link className="text-primary underline" to="/legal/wallet-terms">
              Regulamentul programului
            </Link>{" "}
            · drept de retragere 14 zile.
          </p>

          {items.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">Catalogul se completează în curând.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.description}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatUsd(it.price_cents)}</span>
                  <button
                    onClick={() => setSelected(it)}
                    disabled={
                      (wallet?.balance_cents ?? 0) < Math.max(it.price_cents, MIN_REDEEM_CENTS)
                    }
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    Comandă
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {orders.length > 0 && (
          <section>
            <h2 className="mb-2 text-base font-semibold">Comenzile mele</h2>
            <ul className="space-y-2">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    {o.merch_items?.name ?? "Produs"} ×{o.qty}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatUsd(o.total_cents)} · {o.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {wallet && wallet.ledger.length > 0 && (
          <section>
            <h2 className="mb-2 text-base font-semibold">Istoric</h2>
            <ul className="space-y-1">
              {wallet.ledger.map((e, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {ledgerLabel(e)}
                    {e.status === "pending" && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(în așteptare)</span>
                    )}
                  </span>
                  <span
                    className={e.amount_cents >= 0 ? "text-primary" : "text-muted-foreground"}
                  >
                    {e.amount_cents >= 0 ? "+" : "−"}
                    {formatUsd(Math.abs(e.amount_cents))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-[10px] text-muted-foreground">
          Creditele Suzeta nu sunt bani reali și nu pot fi retrase; se folosesc exclusiv pentru
          produse cu logo Suzeta din catalogul de mai sus.
        </p>
      </div>

      {selected && (
        <OrderDialog
          item={selected}
          onClose={() => setSelected(null)}
          onDone={async () => {
            setSelected(null);
            await reload();
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}

function OrderDialog({
  item,
  onClose,
  onDone,
}: {
  item: MerchItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<Shipping>({
    name: "",
    address: "",
    city: "",
    country: "România",
    phone: "",
  });
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await placeMerchOrder(item.slug, qty, form);
    setBusy(false);
    if (res.ok) {
      toast.success("Comandă înregistrată! Te contactăm pentru livrare.");
      onDone();
    } else {
      toast.error(ORDER_ERRORS[res.error ?? ""] ?? res.error ?? "Eroare");
    }
  }

  const fields: { key: keyof Shipping; label: string }[] = [
    { key: "name", label: "Nume complet" },
    { key: "address", label: "Adresă" },
    { key: "city", label: "Oraș" },
    { key: "country", label: "Țară" },
    { key: "phone", label: "Telefon (opțional)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-4">
        <h3 className="text-base font-semibold">{item.name}</h3>
        <p className="text-xs text-muted-foreground">
          {formatUsd(item.price_cents)} · plătit din portofel
        </p>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Cantitate</span>
          <select
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-2 py-1"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="ml-auto font-semibold">{formatUsd(item.price_cents * qty)}</span>
        </div>

        <div className="mt-3 space-y-2">
          {fields.map((f) => (
            <input
              key={f.key}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.label}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-border px-4 py-2 text-sm"
          >
            Anulează
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "..." : "Trimite comanda"}
          </button>
        </div>
      </div>
    </div>
  );
}
