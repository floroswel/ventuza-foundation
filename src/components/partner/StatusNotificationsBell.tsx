import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  partnerListStatusNotifications,
  partnerMarkNotificationsRead,
} from "@/lib/partner.functions";
import { Bell, Check, X, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Notif = Awaited<ReturnType<typeof partnerListStatusNotifications>>[number];

function decisionMeta(d: Notif["decision"]) {
  switch (d) {
    case "approved":
      return { icon: Check, label: "Aprobat", cls: "text-emerald-600" };
    case "rejected":
      return { icon: X, label: "Respins", cls: "text-red-600" };
    case "changes_requested":
      return { icon: AlertCircle, label: "Cere modificări", cls: "text-orange-600" };
  }
}

function kindLabel(k: Notif["kind"]) {
  return k === "venue" ? "Loc" : k === "event" ? "Eveniment" : "Ofertă";
}

export function StatusNotificationsBell() {
  const list = useServerFn(partnerListStatusNotifications);
  const markRead = useServerFn(partnerMarkNotificationsRead);
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refresh = () => {
    list({ data: undefined })
      .then((rows) => {
        setItems(rows);
        setErrorMsg(null);
      })
      .catch((e: unknown) => {
        // Surface a discrete indicator instead of swallowing the error —
        // a broken bell that silently shows "0 notificări" misleads partners
        // into thinking their items are still pending review.
        const msg = e instanceof Error ? e.message : "Nu am putut încărca notificările.";
        setErrorMsg(msg);
        // eslint-disable-next-line no-console
        console.warn("[StatusNotificationsBell] refresh failed:", msg);
      });
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, []);

  const unread = items.filter((i) => !i.read_at).length;

  const onOpenChange = async (o: boolean) => {
    setOpen(o);
    if (o && unread > 0) {
      try {
        await markRead({ data: {} });
        setItems((prev) => prev.map((p) => ({ ...p, read_at: p.read_at ?? new Date().toISOString() })));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Marcarea ca citit a eșuat.";
        setErrorMsg(msg);
      }
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="relative" title={errorMsg ?? undefined}>
          <Bell className="w-4 h-4" />
          {unread > 0 && !errorMsg && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px]"
            >
              {unread}
            </Badge>
          )}
          {errorMsg && (
            <span
              aria-label="Notificări indisponibile"
              className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto p-0">
        <div className="px-3 py-2 border-b text-sm font-medium">Decizii moderare</div>
        {errorMsg && (
          <div className="px-3 py-2 border-b text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-medium">Notificările nu s-au putut încărca.</div>
              <button
                type="button"
                onClick={refresh}
                className="underline mt-0.5"
              >
                Reîncearcă
              </button>
            </div>
          </div>
        )}
        {items.length === 0 && !errorMsg && (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">
            Nicio decizie nouă încă.
          </div>
        )}
        {items.map((n) => {
          const m = decisionMeta(n.decision);
          const Icon = m.icon;
          return (
            <div
              key={n.id}
              className={`px-3 py-2 border-b last:border-b-0 ${!n.read_at ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${m.cls}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className={`font-medium ${m.cls}`}>{m.label}</span>{" "}
                    <span className="text-muted-foreground">• {kindLabel(n.kind)}</span>
                  </div>
                  {n.item_title && (
                    <div className="text-xs font-medium truncate">{n.item_title}</div>
                  )}
                  {n.reason && (
                    <div className="text-xs text-muted-foreground mt-0.5">{n.reason}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("ro-RO")}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
