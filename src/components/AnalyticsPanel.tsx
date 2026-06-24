import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, ShieldCheck, Activity, MessageCircle, Heart, UserPlus, Flag, Building2, Megaphone, MessageSquare, BarChart3, Loader2 } from "lucide-react";

type Summary = {
  total_users: number;
  verified_users: number;
  dau: number;
  wau: number;
  mau: number;
  msg_24h: number;
  matches_24h: number;
  new_users_7d: number;
  reports_open: number;
  business_pending: number;
  ads_pending: number;
  feedback_new: number;
};

export function AnalyticsPanel() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: r, error } = await supabase.rpc("admin_analytics_summary");
      if (!cancelled) {
        if (!error && r) setData(r as Summary);
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const cards = [
    { icon: Users, label: "Useri total", value: data.total_users, color: "text-primary" },
    { icon: ShieldCheck, label: "Verificați 18+", value: data.verified_users, color: "text-emerald-500" },
    { icon: UserPlus, label: "Noi (7z)", value: data.new_users_7d, color: "text-blue-500" },
    { icon: Activity, label: "DAU", value: data.dau, color: "text-violet-500" },
    { icon: Activity, label: "WAU", value: data.wau, color: "text-violet-500" },
    { icon: Activity, label: "MAU", value: data.mau, color: "text-violet-500" },
    { icon: MessageCircle, label: "Mesaje 24h", value: data.msg_24h, color: "text-cyan-500" },
    { icon: Heart, label: "Match-uri 24h", value: data.matches_24h, color: "text-pink-500" },
    { icon: Flag, label: "Reports deschise", value: data.reports_open, color: "text-amber-500" },
    { icon: Building2, label: "Business pending", value: data.business_pending, color: "text-orange-500" },
    { icon: Megaphone, label: "Ads pending", value: data.ads_pending, color: "text-orange-500" },
    { icon: MessageSquare, label: "Feedback nou", value: data.feedback_new, color: "text-indigo-500" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Analytics live</h2>
        <span className="ml-auto text-xs text-muted-foreground">refresh 30s</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className={`h-4 w-4 ${c.color}`} />{c.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value.toLocaleString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
