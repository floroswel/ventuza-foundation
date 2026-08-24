import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { fetchAmbassadors, ambassadorTier, type AmbassadorRow } from "@/lib/wallet";

export function AmbassadorLeaderboard() {
  const [rows, setRows] = useState<AmbassadorRow[]>([]);
  const [me, setMe] = useState<{ rank: number | null; invites: number }>({
    rank: null,
    invites: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchAmbassadors(20).then((r) => {
      if (!alive) return;
      setRows(r.rows);
      setMe(r.me);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const tier = ambassadorTier(me.invites);

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
        <Trophy className="size-4 text-primary" /> Ambasadori Suzeta
      </h2>

      <div className="mb-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <span className="font-medium">{tier.label}</span>
        {tier.next && (
          <span className="text-muted-foreground">
            {" "}
            · încă {tier.next - me.invites} invitații până la nivelul următor
          </span>
        )}
        {me.rank && <span className="text-muted-foreground"> · locul #{me.rank}</span>}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Încă nimeni în clasament. Poți fi primul ambasador Suzeta.
        </p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r) => (
            <li
              key={r.rank}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                r.is_me ? "border-primary/50 bg-primary/10" : "border-border/60"
              }`}
            >
              <span className="w-6 text-xs text-muted-foreground">#{r.rank}</span>
              <span className="min-w-0 flex-1 truncate">{r.display_name}</span>
              <span className="text-xs text-muted-foreground">{r.invites} invitații</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
