import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Megaphone,
  Loader2,
  Send,
  Users,
  MapPin,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/BackButton";
import {
  partnerSendBroadcast,
  partnerBroadcastQuotaStatus,
  partnerListMyBroadcasts,
  partnerListApprovedVenues,
} from "@/lib/partner-broadcasts.functions";

export const Route = createFileRoute("/partner/broadcasts")({
  head: () => ({
    meta: [
      { title: "Anunțuri — Partener Ventuza" },
      {
        name: "description",
        content:
          "Trimite anunțuri către useri care au acceptat să primească notificări de la parteneri. Doar parteneri Premium activi.",
      },
    ],
  }),
  component: PartnerBroadcastsPage,
});

type TargetKind = "online" | "nearby" | "followers" | "city";

const TARGET_META: Record<TargetKind, { label: string; icon: React.ReactNode; hint: string }> = {
  online: {
    label: "Useri online acum",
    icon: <Users className="size-4" />,
    hint: "Ultimii 15 minute activi. Nu depinde de venue.",
  },
  nearby: {
    label: "În raza venue-ului",
    icon: <MapPin className="size-4" />,
    hint: "Necesită venue. Rază 250 m – 10 km.",
  },
  city: {
    label: "Oraș / travel mode",
    icon: <Building2 className="size-4" />,
    hint: "Useri din orașul venue-ului sau care sunt „travel mode” acolo.",
  },
  followers: {
    label: "Participanți evenimente",
    icon: <Calendar className="size-4" />,
    hint: "Cei care au RSVP la evenimentele tale.",
  },
};

function PartnerBroadcastsPage() {
  const quotaFn = useServerFn(partnerBroadcastQuotaStatus);
  const venuesFn = useServerFn(partnerListApprovedVenues);
  const listFn = useServerFn(partnerListMyBroadcasts);
  const sendFn = useServerFn(partnerSendBroadcast);
  const qc = useQueryClient();

  const quota = useQuery({ queryKey: ["partner-broadcast-quota"], queryFn: () => quotaFn() });
  const venues = useQuery({ queryKey: ["partner-approved-venues"], queryFn: () => venuesFn() });
  const history = useQuery({ queryKey: ["partner-broadcast-history"], queryFn: () => listFn() });

  const [target, setTarget] = useState<TargetKind>("online");
  const [venueId, setVenueId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [radiusKm, setRadiusKm] = useState<number>(5);

  const mut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          title: title.trim(),
          body: body.trim(),
          targetKind: target,
          venueId: target === "online" ? null : venueId || null,
          radiusM: target === "nearby" ? Math.round(radiusKm * 1000) : undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Trimis către ${r.recipients} useri. Ai mai rămas cu ${r.remaining} anunțuri săptămâna asta.`);
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["partner-broadcast-quota"] });
      qc.invalidateQueries({ queryKey: ["partner-broadcast-history"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? e);
      const map: Record<string, string> = {
        plan_not_eligible: "Necesită abonament Premium activ. Fă upgrade din Facturare.",
        partner_suspended: "Contul de partener e suspendat. Contactează support.",
        venue_not_found: "Venue-ul selectat nu există.",
        not_venue_owner: "Nu ești owner-ul venue-ului selectat.",
        venue_not_approved: "Venue-ul nu este încă aprobat și publicat.",
        venue_required: "Alege un venue pentru acest tip de targetare.",
        invalid_radius: "Raza trebuie între 250 m și 10 km.",
        invalid_title: "Titlul trebuie între 4 și 80 caractere.",
        invalid_body: "Mesajul trebuie între 10 și 280 caractere.",
        weekly_quota_exceeded: "Ai atins cota săptămânală. Fă upgrade sau reia peste 7 zile.",
      };
      const key = Object.keys(map).find((k) => msg.includes(k));
      toast.error(key ? map[key] : msg);
    },
  });

  const q = quota.data;
  const canSend =
    !!q?.active &&
    q.plan_code !== "Free" &&
    (q.remaining ?? 0) > 0 &&
    title.trim().length >= (q?.min_title_len ?? 4) &&
    body.trim().length >= (q?.min_body_len ?? 10) &&
    (target === "online" ? true : !!venueId);

  const approvedVenues = venues.data ?? [];

  const titleLen = title.trim().length;
  const bodyLen = body.trim().length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <BackButton />
          <div className="flex items-center gap-2">
            <Megaphone className="size-5 text-primary" />
            <h1 className="text-lg font-bold">Anunțuri</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <QuotaCard loading={quota.isLoading} q={q} />

        {q && !q.active && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium">Abonament inactiv</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pentru a trimite anunțuri către useri ai nevoie de abonament Premium activ.
                </p>
                <Link to="/partner/billing" className="mt-2 inline-block text-xs font-semibold text-primary underline">
                  Deschide Facturare →
                </Link>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compune anunț</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Targetare</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TARGET_META) as TargetKind[]).map((k) => {
                  const meta = TARGET_META[k];
                  const active = target === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTarget(k)}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {meta.icon}
                        {meta.label}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {target !== "online" && (
              <div className="space-y-2">
                <Label>Venue</Label>
                {venues.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Încarc venue-urile…
                  </div>
                ) : approvedVenues.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nu ai venue-uri aprobate. Creează unul și așteaptă moderarea.
                  </p>
                ) : (
                  <Select value={venueId} onValueChange={setVenueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Alege venue…" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedVenues.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                          {v.city ? ` — ${v.city}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {target === "nearby" && (
              <div className="space-y-2">
                <Label>Rază: {radiusKm.toFixed(1)} km</Label>
                <input
                  type="range"
                  min={0.5}
                  max={(q?.max_radius_m ?? 10000) / 1000}
                  step={0.5}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                Titlu{" "}
                <span className="text-xs text-muted-foreground">
                  ({titleLen}/{q?.max_title_len ?? 80})
                </span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, q?.max_title_len ?? 80))}
                placeholder="Ex: Karaoke Night — vineri de la 22:00"
                maxLength={q?.max_title_len ?? 80}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Mesaj{" "}
                <span className="text-xs text-muted-foreground">
                  ({bodyLen}/{q?.max_body_len ?? 280})
                </span>
              </Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, q?.max_body_len ?? 280))}
                placeholder="Ce vrei să anunți? Fii clar și scurt."
                rows={4}
                maxLength={q?.max_body_len ?? 280}
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-4">
              <p className="text-[11px] text-muted-foreground">
                Doar userii care au activat „Anunțuri de la parteneri" primesc mesajul.
                Cooldown {q?.user_cooldown_hours ?? 24}h/user.
              </p>
              <Button
                onClick={() => mut.mutate()}
                disabled={!canSend || mut.isPending}
                className="min-w-[120px]"
              >
                {mut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-1 size-4" /> Trimite
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <HistoryCard loading={history.isLoading} items={history.data ?? []} />
      </main>
    </div>
  );
}

function QuotaCard({
  loading,
  q,
}: {
  loading: boolean;
  q?: {
    plan_code: string;
    active: boolean;
    weekly_cap: number;
    used_7d: number;
    remaining: number;
  };
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Loader2 className="size-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }
  if (!q) return null;
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Plan</p>
          <p className="text-base font-semibold">
            {q.plan_code}{" "}
            {q.active ? (
              <span className="ml-1 text-[10px] font-normal text-green-600">activ</span>
            ) : (
              <span className="ml-1 text-[10px] font-normal text-destructive">inactiv</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Anunțuri săptămâna asta
          </p>
          <p className="text-base font-semibold">
            {q.used_7d} / {q.weekly_cap >= 999999 ? "∞" : q.weekly_cap}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {q.remaining >= 999999 ? "nelimitat" : `mai poți trimite ${q.remaining}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryCard({
  loading,
  items,
}: {
  loading: boolean;
  items: Array<{
    id: string;
    title: string;
    body: string;
    target_kind: string;
    radius_m: number | null;
    recipients_delivered: number;
    created_at: string;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Istoric</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nu ai trimis încă niciun anunț.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((b) => (
              <li key={b.id} className="rounded-lg border border-border/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{b.body}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {b.target_kind}
                      {b.radius_m ? ` · ${(b.radius_m / 1000).toFixed(1)} km` : ""}
                      {" · "}
                      {new Date(b.created_at).toLocaleString("ro-RO")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <CheckCircle2 className="size-3.5" />
                    {b.recipients_delivered}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
