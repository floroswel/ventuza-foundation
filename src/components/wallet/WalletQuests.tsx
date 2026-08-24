import { useEffect, useState } from "react";
import { Target, Check } from "lucide-react";
import { toast } from "sonner";
import {
  fetchWalletQuests,
  claimWalletQuest,
  formatUsd,
  ORDER_ERRORS,
  type WalletQuest,
} from "@/lib/wallet";

export function WalletQuests({ onClaimed }: { onClaimed?: () => void }) {
  const [quests, setQuests] = useState<WalletQuest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setQuests(await fetchWalletQuests());
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function claim(key: string) {
    setBusy(key);
    const res = await claimWalletQuest(key);
    setBusy(null);
    if (res.ok) {
      toast.success(`+${formatUsd(res.cents ?? 0)} în portofel`);
      await load();
      onClaimed?.();
    } else {
      toast.error(ORDER_ERRORS[res.error ?? ""] ?? res.error ?? "Eroare");
    }
  }

  if (loading) return null;
  if (quests.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
        <Target className="size-4 text-primary" /> Misiuni
      </h2>
      <ul className="space-y-2">
        {quests.map((q) => (
          <li
            key={q.key}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{q.label}</p>
              <p className="text-xs text-muted-foreground">+{formatUsd(q.cents)}</p>
            </div>
            {q.claimed ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="size-3.5 text-primary" /> Primit
              </span>
            ) : (
              <button
                onClick={() => claim(q.key)}
                disabled={!q.done || busy === q.key}
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                {busy === q.key ? "..." : q.done ? "Revendică" : "În curs"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
