/**
 * ADMIN — Pagina de notificări livrate unui user.
 *
 * URL: `/admin/users/$id/notifications`
 *
 * Ce afișează:
 *  - Sumar agregat pentru ultimele N zile (total, byKind, byChannel, byDay).
 *  - Timeline paginat cronologic descrescător cu kind + channel + actor_id.
 *
 * Ce NU afișează (garantat by design):
 *  - Body / conținut mesaj. Sursa (`notification_dispatch_log`) nu are
 *    coloană de conținut.
 *  - Titlu notificare, media_url, caption, deep-link cu payload.
 *  - Preview inbox. Aceasta e o suprafață admin, nu client.
 *
 * Trei stări:
 *  - loading: spinner cu cale de ieșire;
 *  - error: banner Reîncearcă + mesaj real;
 *  - empty legitim: „Niciun eveniment în intervalul selectat".
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  Loader2,
  Bell,
  AlertTriangle,
  RefreshCw,
  Info,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

import {
  adminGetUserNotificationsSummary,
  adminGetUserNotificationsTimeline,
} from "@/lib/admin-user-notifications.functions";

export const Route = createFileRoute("/admin/users/$id/notifications")({
  head: () => ({
    meta: [
      { title: "Admin · Notificări user" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminUserNotificationsPage,
});

const RANGE_OPTIONS = [
  { value: "7", label: "Ultimele 7 zile" },
  { value: "30", label: "Ultimele 30 de zile" },
  { value: "90", label: "Ultimele 90 de zile" },
  { value: "365", label: "Ultimul an" },
];

function fmt(dt: string | null | undefined) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("ro-RO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return dt;
  }
}

function AdminUserNotificationsPage() {
  const { id: userId } = Route.useParams();
  const [sinceDays, setSinceDays] = useState<number>(30);
  const [kindFilter, setKindFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");

  const getSummary = useServerFn(adminGetUserNotificationsSummary);
  const getTimeline = useServerFn(adminGetUserNotificationsTimeline);

  const summaryQ = useQuery({
    queryKey: ["admin-user-notif-summary", userId, sinceDays],
    queryFn: () => getSummary({ data: { userId, sinceDays } }),
    retry: false,
  });

  const timelineQ = useQuery({
    queryKey: ["admin-user-notif-timeline", userId, kindFilter, channelFilter],
    queryFn: () =>
      getTimeline({
        data: {
          userId,
          limit: 100,
          kind: kindFilter || undefined,
          channel: channelFilter || undefined,
        },
      }),
    retry: false,
  });

  const summary = summaryQ.data;
  const timeline = timelineQ.data;

  const uniqueKinds = summary?.byKind.map((k) => k.kind) ?? [];
  const uniqueChannels = summary?.byChannel.map((c) => c.channel) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/users/$id" params={{ id: userId }}>
            <ChevronLeft className="h-4 w-4" />
            Înapoi la user
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={String(sinceDays)}
            onValueChange={(v) => setSinceDays(Number(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              summaryQ.refetch();
              timelineQ.refetch();
            }}
            disabled={summaryQ.isFetching || timelineQ.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                summaryQ.isFetching || timelineQ.isFetching ? "animate-spin" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      <header className="flex items-start gap-3">
        <Bell className="mt-1 h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Notificări livrate</h1>
          <p className="text-sm text-muted-foreground">
            Metadata de livrare (tip, canal, timestamp). Această pagină nu
            afișează niciodată conținutul mesajului sau al notificării — sursa
            este `notification_dispatch_log`, care nu stochează body.
          </p>
        </div>
      </header>

      <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Pentru a vedea conținut real (excepțional, cu justificare), folosește
          fluxul de <strong>break-glass</strong> pentru mesaje. Această pagină
          este read-only și append-only-safe.
        </span>
      </div>

      {/* ─── SUMMARY ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Sumar ultimele {sinceDays} zile</h2>

        {summaryQ.isLoading ? (
          <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă sumarul…
          </Card>
        ) : summaryQ.error ? (
          <Card className="p-4 border-destructive/50 bg-destructive/10">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div className="flex-1 text-sm">
                <div className="font-medium">
                  {/forbidden|denied|rol|role|policy|permission/i.test(
                    String((summaryQ.error as Error).message),
                  )
                    ? "Acces refuzat"
                    : "Eroare la încărcarea sumarului"}
                </div>
                <div className="opacity-80">{(summaryQ.error as Error).message}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => summaryQ.refetch()}>
                Reîncearcă
              </Button>
            </div>
          </Card>
        ) : !summary || summary.total === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Niciun eveniment în intervalul selectat. Empty legitim — nu este eroare.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-semibold">
                {summary.total}
                {summary.truncated && (
                  <span className="ml-1 text-xs text-muted-foreground">(cap)</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Prima: {fmt(summary.firstAt)}
                <br />
                Ultima: {fmt(summary.lastAt)}
              </div>
            </Card>

            <Card className="p-4 md:col-span-1">
              <div className="text-xs text-muted-foreground mb-2">
                După canal
              </div>
              <div className="space-y-1">
                {summary.byChannel.map((c) => (
                  <div
                    key={c.channel}
                    className="flex items-center justify-between text-sm"
                  >
                    <Badge variant="outline">{c.channel}</Badge>
                    <span className="tabular-nums">{c.count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 md:col-span-2">
              <div className="text-xs text-muted-foreground mb-2">După tip</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {summary.byKind.map((k) => (
                  <div
                    key={k.kind}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate" title={k.kind}>{k.kind}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {k.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 md:col-span-4">
              <div className="text-xs text-muted-foreground mb-2">Pe zile</div>
              <DaySparkline data={summary.byDay} />
            </Card>
          </div>
        )}
      </section>

      <Separator />

      {/* ─── TIMELINE ────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium mr-auto">Timeline</h2>
          <Select
            value={kindFilter || "__all"}
            onValueChange={(v) => setKindFilter(v === "__all" ? "" : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Toate tipurile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Toate tipurile</SelectItem>
              {uniqueKinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={channelFilter || "__all"}
            onValueChange={(v) => setChannelFilter(v === "__all" ? "" : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Toate canalele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Toate canalele</SelectItem>
              {uniqueChannels.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {timelineQ.isLoading ? (
          <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă timeline-ul…
          </Card>
        ) : timelineQ.error ? (
          <Card className="p-4 border-destructive/50 bg-destructive/10">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div className="flex-1 text-sm">
                <div className="font-medium">
                  {/forbidden|denied|rol|role|policy|permission/i.test(
                    String((timelineQ.error as Error).message),
                  )
                    ? "Acces refuzat"
                    : "Eroare la încărcarea timeline-ului"}
                </div>
                <div className="opacity-80">
                  {(timelineQ.error as Error).message}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => timelineQ.refetch()}>
                Reîncearcă
              </Button>
            </div>
          </Card>
        ) : !timeline || timeline.items.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Niciun eveniment în timeline pentru filtrele curente.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Când</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Corelare</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeline.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {fmt(it.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{it.kind}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{it.channel}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {it.actor_id ? it.actor_id.slice(0, 8) + "…" : "sistem"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {it.message_id ? (
                        <span
                          className="text-muted-foreground"
                          title={`message_id: ${it.message_id}`}
                        >
                          msg:{it.message_id.slice(0, 8)}…
                        </span>
                      ) : it.event_id ? (
                        <span
                          className="text-muted-foreground"
                          title={`event_id: ${it.event_id}`}
                        >
                          evt:{it.event_id.slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>

            </Table>
            {timeline.nextBefore && (
              <div className="p-3 text-xs text-muted-foreground text-center border-t">
                Se afișează primele {timeline.items.length} evenimente. Restrânge
                intervalul sau filtrul pentru a vedea mai puține.
              </div>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}

function DaySparkline({ data }: { data: Array<{ day: string; count: number }> }) {
  if (data.length === 0) {
    return <div className="text-xs text-muted-foreground">Fără date.</div>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d) => {
        const h = Math.max(2, Math.round((d.count / max) * 92));
        return (
          <div
            key={d.day}
            className="flex-1 min-w-[6px] bg-primary/70 rounded-sm hover:bg-primary transition-colors"
            style={{ height: `${h}px` }}
            title={`${d.day}: ${d.count}`}
          />
        );
      })}
    </div>
  );
}
