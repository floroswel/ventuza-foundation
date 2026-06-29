import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import {
  partnerListMyItems,
  partnerGetQuota,
  partnerCreateVenue,
  partnerUpdateVenue,
  partnerCreateEvent,
  partnerUpdateEvent,
  partnerCreateOffer,
  partnerUpdateOffer,
  partnerGetOfferStats,
} from "@/lib/partner.functions";
import { claimBusinessApplicationByCode } from "@/lib/business.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, AlertTriangle, MapPin, Image as ImgIcon, BarChart3, ChevronLeft, BookOpen } from "lucide-react";
import { toast } from "sonner";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PostingWizard } from "@/components/partner/PostingWizard";
import { StatusNotificationsBell } from "@/components/partner/StatusNotificationsBell";
import { StatusTiles } from "@/components/partner/StatusTiles";

export const Route = createFileRoute("/partner")({
  head: () => ({
    meta: [
      { title: "Portal Partener — Ventuza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartnerPortal,
});

/* ============================== STATUS BADGE ============================== */

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    pending: { label: "În așteptare", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
    approved: { label: "Aprobat", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    rejected: { label: "Respins", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
    changes_requested: { label: "Cere modificări", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  };
  const m = map[status ?? "pending"] ?? map.pending;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

/* ================================= PAGE ================================== */

function PartnerPortal() {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();

  const [quota, setQuota] = useState<Awaited<ReturnType<typeof partnerGetQuota>> | null>(null);
  const [items, setItems] = useState<Awaited<ReturnType<typeof partnerListMyItems>>>({
    venues: [],
    events: [],
    offers: [],
  });
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState<
    | null
    | { kind: "venue"; row?: any }
    | { kind: "event"; row?: any }
    | { kind: "offer"; row?: any }
    | { kind: "stats"; offerId: string; title: string }
  >(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pendingApp, setPendingApp] = useState<{ id: string; status: string; legal_name: string | null } | null>(null);
  const [pendingChecked, setPendingChecked] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const listFn = useServerFn(partnerListMyItems);
  const quotaFn = useServerFn(partnerGetQuota);

  const [suspendedMsg, setSuspendedMsg] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setSuspendedMsg(null);
    const [iRes, qRes] = await Promise.allSettled([
      listFn({ data: undefined }),
      quotaFn({ data: undefined }),
    ]);
    if (iRes.status === "fulfilled") setItems(iRes.value);
    if (qRes.status === "fulfilled") setQuota(qRes.value);
    const err = (iRes.status === "rejected" && iRes.reason) || (qRes.status === "rejected" && qRes.reason);
    if (err) {
      const msg = (err as Error).message ?? "Eroare la încărcare";
      if (msg.startsWith("suspended:")) setSuspendedMsg(msg.replace(/^suspended:\s*/, ""));
      else toast.error(msg);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    if (!roles.includes("business") && !roles.includes("admin")) {
      // Non-partner — check for a pending application so we can show a real
      // status instead of the same CTA as someone who never applied.
      let alive = true;
      const fetchApp = async () => {
        try {
          const { data, error } = await supabase
            .from("business_applications")
            .select("id, status, legal_name")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!alive) return;
          if (error) throw error;
          setPendingApp(data ?? null);
          setPendingError(null);
        } catch (e: any) {
          if (!alive) return;
          setPendingError(e?.message ?? "Nu am putut verifica cererea.");
        } finally {
          if (alive) setPendingChecked(true);
        }
      };
      void fetchApp();
      // Auto-detect approval: poll user_roles every 15s + realtime on insert.
      const interval = setInterval(async () => {
        const { data: rolesRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        if (rolesRow?.some((r) => r.role === "business" || r.role === "admin")) {
          window.location.reload();
        } else {
          void fetchApp();
        }
      }, 15000);
      const ch = supabase
        .channel(`user-roles-${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` }, () => {
          window.location.reload();
        })
        .subscribe();
      return () => { alive = false; clearInterval(interval); supabase.removeChannel(ch); };
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roles, authLoading, rolesLoading]);


  if (authLoading || rolesLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (!user) return null;

  const isPartner = roles.includes("business") || roles.includes("admin");
  if (!isPartner) {
    if (!pendingChecked) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin" />
        </div>
      );
    }
    if (pendingError) {
      return (
        <div className="max-w-xl mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Portal Partener</h1>
          <div className="rounded border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Nu am putut verifica statusul cererii tale.</p>
            <p className="text-xs text-muted-foreground mt-1">{pendingError}</p>
          </div>
          <Button onClick={() => { setPendingChecked(false); setPendingError(null); window.location.reload(); }}>
            Reîncearcă
          </Button>
        </div>
      );
    }
    if (pendingApp) {
      const fullId = pendingApp.id;
      const mailto = `mailto:business@ventuza.app?subject=${encodeURIComponent(`Cerere partener ${fullId}`)}&body=${encodeURIComponent(`Bună,\n\nID cerere: ${fullId}\nDenumire: ${pendingApp.legal_name ?? "—"}\n\n[descrie aici clarificarea]\n\nMulțumesc.`)}`;
      const statusLabels: Record<string, { label: string; cls: string; desc: string }> = {
        pending: {
          label: "În așteptare",
          cls: "border-yellow-500/40 bg-yellow-500/5",
          desc: "Cererea ta a fost primită. Echipa Ventuza o analizează în maximum 3 zile lucrătoare.",
        },
        reviewing: {
          label: "În analiză",
          cls: "border-blue-500/40 bg-blue-500/5",
          desc: "Un membru al echipei verifică documentele tale. Te anunțăm pe email.",
        },
        needs_info: {
          label: "Necesită clarificări",
          cls: "border-orange-500/40 bg-orange-500/5",
          desc: "Avem nevoie de informații suplimentare. Apasă „Trimite clarificări” — emailul e pre-completat cu ID-ul cererii.",
        },
        rejected: {
          label: "Respinsă",
          cls: "border-red-500/40 bg-red-500/5",
          desc: "Cererea a fost respinsă. Pentru clarificări scrie la business@ventuza.app.",
        },
        approved: {
          label: "Aprobată",
          cls: "border-emerald-500/40 bg-emerald-500/5",
          desc: "Reîmprospătează pagina — accesul tău de partener se activează automat.",
        },
      };
      const s = statusLabels[pendingApp.status] ?? statusLabels.pending;
      return (
        <div className="max-w-xl mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Portal Partener</h1>
          <Card className={s.cls}>
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Cererea ta:</span>
                <span className="text-sm font-semibold">{s.label}</span>
              </div>
              {pendingApp.legal_name && (
                <p className="text-xs text-muted-foreground">{pendingApp.legal_name}</p>
              )}
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              {pendingApp.status === "approved" && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Detectăm aprobarea automat — pagina se va reîncărca singură.
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <p className="text-[11px] text-muted-foreground">ID cerere:</p>
                <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded break-all">{fullId}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    navigator.clipboard?.writeText(fullId).then(
                      () => toast.success("ID copiat"),
                      () => toast.error("Nu am putut copia"),
                    );
                  }}
                >
                  Copiază
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/partner/guide"><BookOpen className="w-4 h-4 mr-1" /> Vezi ghidul partenerului</Link>
            </Button>
            {pendingApp.status === "needs_info" ? (
              <Button size="sm" asChild>
                <a href={mailto}>Trimite clarificări</a>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <a href={mailto}>Contactează echipa</a>
              </Button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Portal Partener</h1>
        <p className="text-muted-foreground">
          Acest portal este disponibil doar conturilor partener aprobate. Aplică pentru un cont
          partener din secțiunea Business.
        </p>
        <Button asChild>
          <Link to="/business">Aplică pentru cont partener</Link>
        </Button>
        <ClaimByCodeCard onClaimed={() => window.location.reload()} />
      </div>
    );
  }

  const suspended = !!quota?.suspended || !!suspendedMsg;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5 pb-24">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ChevronLeft className="w-4 h-4" /> Acasă
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold flex-1">Portal Partener</h1>
        <StatusNotificationsBell />
        <Button variant="outline" size="sm" asChild>
          <Link to="/partner/guide">
            <BookOpen className="w-4 h-4 mr-1" /> Ghid
          </Link>
        </Button>
      </div>

      {suspended && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">Contul partener este suspendat.</div>
              <div className="text-muted-foreground">
                Conținutul tău nu este vizibil în Nearby și nu poți crea sau edita resurse.
                Contactează echipa de moderare.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <StatusTiles items={items} />

      {quota && <QuotaPanel quota={quota} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="lg"
          disabled={suspended}
          onClick={() => setWizardOpen(true)}
        >
          <Plus className="w-4 h-4 mr-1" /> Postare nouă (ghidat)
        </Button>
        <div className="flex flex-wrap gap-2">
          <Link to="/partner/billing">
            <Button variant="outline" size="sm">Facturare & abonament →</Button>
          </Link>
          <Link to="/business/dashboard">
            <Button variant="outline" size="sm">Campanii publicitare →</Button>
          </Link>
        </div>
      </div>


      <Tabs defaultValue="venues">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="venues">Locuri ({items.venues.length})</TabsTrigger>
          <TabsTrigger value="events">Evenimente ({items.events.length})</TabsTrigger>
          <TabsTrigger value="offers">Oferte ({items.offers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="venues" className="space-y-3">
          {loading ? <Loader2 className="animate-spin" /> : null}
          {items.venues.map((v: any) => (
            <ItemRow
              key={v.id}
              title={v.name}
              subtitle={`${v.category ?? "—"} • ${v.city ?? ""}`}
              cover={v.cover_url}
              status={v.moderation_status}
              reason={v.rejection_reason}
              onEdit={suspended ? undefined : () => setOpenDialog({ kind: "venue", row: v })}
            />
          ))}
          {!loading && items.venues.length === 0 && (
            <p className="text-sm text-muted-foreground">Niciun loc adăugat încă.</p>
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-3">
          {loading ? <Loader2 className="animate-spin" /> : null}
          {items.events.map((e: any) => (
            <ItemRow
              key={e.id}
              title={e.title}
              subtitle={`${new Date(e.starts_at).toLocaleString("ro-RO")} • ${e.city ?? ""}`}
              cover={e.cover_url}
              status={e.moderation_status}
              reason={e.rejection_reason}
              official={e.is_official}
              onEdit={suspended ? undefined : () => setOpenDialog({ kind: "event", row: e })}
            />
          ))}
          {!loading && items.events.length === 0 && (
            <p className="text-sm text-muted-foreground">Niciun eveniment.</p>
          )}
        </TabsContent>

        <TabsContent value="offers" className="space-y-3">
          {loading ? <Loader2 className="animate-spin" /> : null}
          {!loading && items.venues.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Adaugă întâi un loc înainte să creezi o ofertă.
            </p>
          )}
          {!loading && items.venues.length > 0 && !items.venues.some((v: any) => v.moderation_status === "approved") && (
            <p className="text-sm text-muted-foreground">
              Ai locuri adăugate, dar niciunul aprobat încă. Ofertele se pot atașa doar pe locuri aprobate.
            </p>
          )}
          {items.offers.map((o: any) => (
            <ItemRow
              key={o.id}
              title={o.title}
              subtitle={`${o.venues?.name ?? ""}`}
              status={o.moderation_status}
              reason={o.rejection_reason}
              onEdit={suspended ? undefined : () => setOpenDialog({ kind: "offer", row: o })}
              extra={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenDialog({ kind: "stats", offerId: o.id, title: o.title })}
                >
                  <BarChart3 className="w-4 h-4 mr-1" /> Stats
                </Button>
              }
            />
          ))}
          {!loading && items.offers.length === 0 && (
            <p className="text-sm text-muted-foreground">Nicio ofertă.</p>
          )}
        </TabsContent>
      </Tabs>

      {openDialog?.kind === "venue" && (
        <VenueDialog
          row={openDialog.row}
          onClose={() => setOpenDialog(null)}
          onSaved={() => {
            setOpenDialog(null);
            refresh();
          }}
        />
      )}
      {openDialog?.kind === "event" && (
        <EventDialog
          row={openDialog.row}
          venues={items.venues}
          onClose={() => setOpenDialog(null)}
          onSaved={() => {
            setOpenDialog(null);
            refresh();
          }}
        />
      )}
      {openDialog?.kind === "offer" && (
        <OfferDialog
          row={openDialog.row}
          venues={items.venues}
          onClose={() => setOpenDialog(null)}
          onSaved={() => {
            setOpenDialog(null);
            refresh();
          }}
        />
      )}
      {openDialog?.kind === "stats" && (
        <StatsDialog
          offerId={openDialog.offerId}
          title={openDialog.title}
          onClose={() => setOpenDialog(null)}
        />
      )}

      <PostingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => refresh()}
        quota={quota as any}
        myVenues={items.venues as any}
      />
    </div>
  );
}

/* ============================== SUB-COMPONENTS ============================ */

function QuotaPanel({ quota }: { quota: NonNullable<Awaited<ReturnType<typeof partnerGetQuota>>> }) {
  const rows = [
    { l: "Locuri", used: quota.venues, max: quota.quotas.max_venues },
    { l: "Evenimente", used: quota.events, max: quota.quotas.max_events },
    { l: "Oferte active", used: quota.offers, max: quota.quotas.max_active_offers },
    { l: "Drafts (ultima oră)", used: quota.drafts_last_hour, max: quota.quotas.max_drafts_per_hour },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Limite cont</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {rows.map((r) => {
          const pct = Math.min(100, Math.round((r.used / Math.max(r.max, 1)) * 100));
          const danger = r.used >= r.max;
          return (
            <div key={r.l}>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{r.l}</span>
                <span className={danger ? "text-red-500 font-medium" : ""}>
                  {r.used}/{r.max}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded mt-1 overflow-hidden">
                <div
                  className={`h-full ${danger ? "bg-red-500" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ItemRow(props: {
  title: string;
  subtitle?: string;
  cover?: string | null;
  status: string | null;
  reason?: string | null;
  official?: boolean;
  onEdit?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-4 flex gap-3 items-start">
        {props.cover ? (
          <img
            src={props.cover}
            alt=""
            className="w-16 h-16 rounded object-cover bg-muted"
            loading="lazy"
          />
        ) : (
          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
            <ImgIcon className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{props.title}</span>
            <StatusBadge status={props.status} />
            {props.official && <Badge variant="secondary">Oficial</Badge>}
          </div>
          {props.subtitle && (
            <div className="text-xs text-muted-foreground truncate">{props.subtitle}</div>
          )}
          {props.reason && (props.status === "rejected" || props.status === "changes_requested") && (
            <div className="text-xs text-orange-600 mt-1">Motiv staff: {props.reason}</div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {props.onEdit && (
            <Button size="sm" variant="outline" onClick={props.onEdit}>
              Editează
            </Button>
          )}
          {props.extra}
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- VENUE DIALOG ------------------------------ */

function PinMap({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [lng, lat],
      zoom: 13,
    });
    mapRef.current = map;
    const marker = new maplibregl.Marker({ color: "#dc2626", draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLngLat();
      onChange(p.lat, p.lng);
    });
    map.on("click", (e) => {
      marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
      onChange(e.lngLat.lat, e.lngLat.lng);
    });
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (markerRef.current) markerRef.current.setLngLat([lng, lat]);
  }, [lat, lng]);

  return (
    <div className="space-y-1">
      <div ref={ref} className="w-full h-56 rounded border" />
      <div className="text-xs text-muted-foreground">
        Click pe hartă sau trage pin-ul pentru a seta locația.
      </div>
    </div>
  );
}

async function uploadCover(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Doar imagini sunt acceptate.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Imagine max 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("venue-media").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  // TTL 5 ani — evită spargerea imaginilor după 30 zile. Bucket-ul rămâne privat;
  // re-semnarea on-read va veni la refactorul `cover_path` (Val 6).
  const { data } = await supabase.storage.from("venue-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (!data?.signedUrl) throw new Error("Nu s-a putut obține URL.");
  return data.signedUrl;
}

function VenueDialog({ row, onClose, onSaved }: { row?: any; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const create = useServerFn(partnerCreateVenue);
  const update = useServerFn(partnerUpdateVenue);
  const isEdit = !!row?.id;
  const [form, setForm] = useState({
    name: row?.name ?? "",
    category: row?.category ?? "",
    description: row?.description ?? "",
    address: row?.address ?? "",
    city: row?.city ?? "",
    lat: row?.lat ?? 44.4268,
    lng: row?.lng ?? 26.1025,
    cover_url: row?.cover_url ?? "",
    website: row?.website ?? "",
    phone_e164: row?.phone_e164 ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const payload: any = {
        name: form.name,
        category: form.category || null,
        description: form.description || null,
        address: form.address || null,
        city: form.city || null,
        lat: Number(form.lat),
        lng: Number(form.lng),
        cover_url: form.cover_url || null,
        website: form.website || null,
        phone_e164: form.phone_e164 || null,
      };
      if (isEdit) {
        const r = await update({ data: { id: row.id, patch: payload } });
        toast.success(r.re_moderation ? "Salvat. Re-trimis la moderare." : "Salvat.");
      } else {
        await create({ data: payload });
        toast.success("Loc creat. În așteptare la moderare.");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Eroare la salvare");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editează loc" : "Loc nou"}</DialogTitle>
          <DialogDescription>
            {isEdit && row?.moderation_status === "approved"
              ? "Editarea va retrimite locul la moderare."
              : "Va fi trimis la moderare înainte de a apărea public."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nume *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
            </div>
            <div>
              <Label>Categorie</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="bar, club, restaurant…" />
            </div>
            <div>
              <Label>Oraș</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Descriere</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={4000} rows={3} />
            </div>
            <div className="col-span-2">
              <Label>Adresă</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <Label>Telefon (E.164)</Label>
              <Input value={form.phone_e164} onChange={(e) => setForm({ ...form, phone_e164: e.target.value })} placeholder="+40…" />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1">
              <MapPin className="w-4 h-4" /> Locație pe hartă *
            </Label>
            <PinMap
              lat={form.lat}
              lng={form.lng}
              onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
            />
          </div>

          <div>
            <Label>Imagine de copertă</Label>
            <input
              type="file"
              accept="image/*"
              className="block text-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f || !user) return;
                try {
                  const url = await uploadCover(user.id, f);
                  setForm((s) => ({ ...s, cover_url: url }));
                  toast.success("Imagine încărcată.");
                } catch (err: any) {
                  toast.error(err.message);
                }
              }}
            />
            {form.cover_url && (
              <img src={form.cover_url} alt="" className="mt-2 max-h-32 rounded" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Anulează
          </Button>
          <Button onClick={submit} disabled={busy || !form.name}>
            {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Salvează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- EVENT DIALOG ------------------------------ */

function EventDialog({
  row,
  venues,
  onClose,
  onSaved,
}: {
  row?: any;
  venues: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const create = useServerFn(partnerCreateEvent);
  const update = useServerFn(partnerUpdateEvent);
  const isEdit = !!row?.id;
  const firstVenue = venues[0];
  const [form, setForm] = useState({
    title: row?.title ?? "",
    description: row?.description ?? "",
    event_type: row?.event_type ?? "other",
    city: row?.city ?? firstVenue?.city ?? "",
    venue: row?.venue ?? firstVenue?.name ?? "",
    lat: row?.lat ?? firstVenue?.lat ?? 44.4268,
    lng: row?.lng ?? firstVenue?.lng ?? 26.1025,
    starts_at: row?.starts_at?.slice(0, 16) ?? "",
    ends_at: row?.ends_at?.slice(0, 16) ?? "",
    max_attendees: row?.max_attendees ?? "",
    cover_url: row?.cover_url ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.starts_at) {
      toast.error("Setează data de început.");
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        city: form.city || null,
        venue: form.venue || null,
        lat: Number(form.lat),
        lng: Number(form.lng),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        max_attendees: form.max_attendees ? Number(form.max_attendees) : null,
        cover_url: form.cover_url || null,
      };
      if (isEdit) {
        const r = await update({ data: { id: row.id, patch: payload } });
        toast.success(r.re_moderation ? "Salvat. Re-trimis la moderare." : "Salvat.");
      } else {
        await create({ data: payload });
        toast.success("Eveniment creat. În așteptare la moderare.");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Eroare");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editează eveniment" : "Eveniment nou"}</DialogTitle>
          <DialogDescription>
            {isEdit && row?.moderation_status === "approved"
              ? "Editarea va retrimite evenimentul la moderare."
              : "Va fi trimis la moderare."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titlu *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} />
          </div>
          <div>
            <Label>Descriere</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Început *</Label>
              <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div>
              <Label>Sfârșit</Label>
              <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </div>
            <div>
              <Label>Oraș</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Capacitate</Label>
              <Input type="number" value={form.max_attendees} onChange={(e) => setForm({ ...form, max_attendees: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Loc</Label>
            <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <MapPin className="w-4 h-4" /> Locație *
            </Label>
            <PinMap lat={form.lat} lng={form.lng} onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))} />
          </div>
          <div>
            <Label>Imagine de copertă</Label>
            <input
              type="file"
              accept="image/*"
              className="block text-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f || !user) return;
                try {
                  const url = await uploadCover(user.id, f);
                  setForm((s) => ({ ...s, cover_url: url }));
                } catch (err: any) {
                  toast.error(err.message);
                }
              }}
            />
            {form.cover_url && <img src={form.cover_url} alt="" className="mt-2 max-h-32 rounded" />}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Anulează
          </Button>
          <Button onClick={submit} disabled={busy || !form.title}>
            {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Salvează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- OFFER DIALOG ------------------------------ */

function OfferDialog({
  row,
  venues,
  onClose,
  onSaved,
}: {
  row?: any;
  venues: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useServerFn(partnerCreateOffer);
  const update = useServerFn(partnerUpdateOffer);
  const isEdit = !!row?.id;
  const [form, setForm] = useState({
    venue_id: row?.venue_id ?? venues[0]?.id ?? "",
    title: row?.title ?? "",
    description: row?.description ?? "",
    terms: row?.terms ?? "",
    valid_from: row?.valid_from?.slice(0, 16) ?? "",
    valid_to: row?.valid_to?.slice(0, 16) ?? "",
    max_claims_per_user: row?.max_claims_per_user ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const payload: any = {
        venue_id: form.venue_id,
        title: form.title,
        description: form.description || null,
        terms: form.terms || null,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
        valid_to: form.valid_to ? new Date(form.valid_to).toISOString() : null,
        max_claims_per_user: form.max_claims_per_user ? Number(form.max_claims_per_user) : null,
      };
      if (isEdit) {
        const r = await update({ data: { id: row.id, patch: payload } });
        toast.success(r.re_moderation ? "Salvat. Re-trimis la moderare." : "Salvat.");
      } else {
        await create({ data: payload });
        toast.success("Ofertă creată. În așteptare la moderare.");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Eroare");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editează ofertă" : "Ofertă nouă"}</DialogTitle>
          <DialogDescription>
            {isEdit && row?.moderation_status === "approved"
              ? "Editarea va retrimite oferta la moderare."
              : "Va fi trimisă la moderare."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Loc *</Label>
            <Select value={form.venue_id} onValueChange={(v) => setForm({ ...form, venue_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Alege un loc al tău" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Titlu *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} />
          </div>
          <div>
            <Label>Descriere</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div>
            <Label>Condiții / termeni</Label>
            <Textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valabil de la</Label>
              <Input type="datetime-local" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            </div>
            <div>
              <Label>Valabil până la</Label>
              <Input type="datetime-local" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
            </div>
            <div>
              <Label>Max revendicări/user</Label>
              <Input type="number" value={form.max_claims_per_user} onChange={(e) => setForm({ ...form, max_claims_per_user: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Anulează
          </Button>
          <Button onClick={submit} disabled={busy || !form.title || !form.venue_id}>
            {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Salvează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- STATS DIALOG ------------------------------ */

function StatsDialog({ offerId, title, onClose }: { offerId: string; title: string; onClose: () => void }) {
  const get = useServerFn(partnerGetOfferStats);
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    get({ data: { offer_id: offerId } })
      .then(setStats)
      .catch((e) => toast.error(e.message));
  }, [offerId]);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Statistici ofertă</DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>
        {!stats ? (
          <Loader2 className="animate-spin" />
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revendicări totale</span>
              <span className="font-medium">{stats.claim_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Răscumpărate</span>
              <span className="font-medium">{stats.redeemed_count}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Doar agregat — identitatea userilor nu este expusă.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============================ CLAIM BY CODE ============================== */
function ClaimByCodeCard({ onClaimed }: { onClaimed: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const claim = useServerFn(
    (require("@/lib/business.functions") as typeof import("@/lib/business.functions")).claimBusinessApplicationByCode,
  );
  // Hidrare opțională din localStorage (vz_biz_app).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vz_biz_app");
      if (raw) {
        const { id } = JSON.parse(raw);
        if (id && typeof id === "string") setCode(id);
      }
    } catch { /* ignore */ }
  }, []);
  async function submit() {
    const id = code.trim();
    if (!id) return toast.error("Introdu ID-ul cererii.");
    setBusy(true);
    try {
      const res = await claim({ data: { appId: id } });
      toast.success(`Cerere revendicată: ${res.legal_name ?? id} (${res.status})`);
      try { localStorage.removeItem("vz_biz_app"); } catch { /* ignore */ }
      onClaimed();
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ai un cod de cerere?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Dacă ai trimis cererea fără cont (sau cu alt email), introdu aici ID-ul afișat după submit ca să o legăm de contul tău.
        </p>
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex: 1a2b3c4d-..." className="font-mono text-xs" />
          <Button disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Revendică"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
