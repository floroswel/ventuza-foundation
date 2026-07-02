import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";

type Items = {
  venues: Array<{ moderation_status?: string | null }>;
  events: Array<{ moderation_status?: string | null }>;
  offers: Array<{ moderation_status?: string | null }>;
};

function countAll(items: Items, predicate: (s: string | null | undefined) => boolean) {
  const c = (arr: Array<{ moderation_status?: string | null }>) =>
    arr.filter((x) => predicate(x.moderation_status)).length;
  return c(items.venues) + c(items.events) + c(items.offers);
}

export function StatusTiles({ items }: { items: Items }) {
  const live = countAll(items, (s) => s === "approved");
  const pending = countAll(items, (s) => s === "pending");
  const attention = countAll(items, (s) => s === "rejected" || s === "changes_requested");

  const tiles = [
    {
      label: "Live (publicat)",
      value: live,
      icon: CheckCircle2,
      cls: "text-emerald-600",
      ring: "border-emerald-500/30 bg-emerald-500/5",
    },
    {
      label: "În moderare",
      value: pending,
      icon: Clock,
      cls: "text-yellow-600",
      ring: "border-yellow-500/30 bg-yellow-500/5",
    },
    {
      label: "Necesită atenție",
      value: attention,
      icon: AlertTriangle,
      cls: attention > 0 ? "text-red-600" : "text-muted-foreground",
      ring: attention > 0 ? "border-red-500/40 bg-red-500/10" : "border-border bg-muted/30",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <Card key={t.label} className={t.ring}>
            <CardContent className="pt-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${t.cls}`} />
              <div>
                <div className={`text-xl font-semibold ${t.cls}`}>{t.value}</div>
                <div className="text-xs text-muted-foreground">{t.label}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
