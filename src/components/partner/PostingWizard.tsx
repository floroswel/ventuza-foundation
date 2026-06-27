/**
 * Guided 5-step posting wizard for partners.
 *
 * Steps: Type → Details (template-driven) → Location + radius → Preview → Submit.
 *
 * Server contracts (partner.functions.ts) and DB triggers are unchanged.
 * Quota and re-moderation are enforced server-side; this is pure UX.
 *
 * AGENTS.md — REGULĂ WIZARD PARTENER.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  partnerCreateVenue,
  partnerCreateEvent,
  partnerCreateOffer,
} from "@/lib/partner.functions";
import {
  PARTNER_TEMPLATES,
  validateTemplate,
  type PartnerField,
  type PartnerKind,
  type PartnerTemplate,
} from "@/lib/partner-templates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  MapPin,
  Eye,
  Send,
  AlertTriangle,
  Lightbulb,
  Image as ImgIcon,
} from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Quota = {
  venues: number;
  events: number;
  offers: number;
  quotas: { max_venues: number; max_events: number; max_active_offers: number };
} | null;

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  quota: Quota;
  myVenues: Array<{ id: string; name: string; lat?: number; lng?: number; city?: string }>;
};

const DEFAULT_RADIUS = 1500;
const MIN_RADIUS = 100;
const MAX_RADIUS = 10000;

export function PostingWizard({ open, onClose, onCreated, quota, myVenues }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<PartnerKind | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [lat, setLat] = useState(44.4268);
  const [lng, setLng] = useState(26.1025);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [busy, setBusy] = useState(false);

  const createVenue = useServerFn(partnerCreateVenue);
  const createEvent = useServerFn(partnerCreateEvent);
  const createOffer = useServerFn(partnerCreateOffer);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setKind(null);
    setValues({});
    setRadius(DEFAULT_RADIUS);
  }, [open]);

  const template: PartnerTemplate | null = kind ? PARTNER_TEMPLATES[kind] : null;

  // Quota check per kind
  const quotaState = useMemo(() => {
    if (!quota) return {} as Record<PartnerKind, { left: number; max: number; full: boolean }>;
    return {
      venue: {
        left: Math.max(0, quota.quotas.max_venues - quota.venues),
        max: quota.quotas.max_venues,
        full: quota.venues >= quota.quotas.max_venues,
      },
      event: {
        left: Math.max(0, quota.quotas.max_events - quota.events),
        max: quota.quotas.max_events,
        full: quota.events >= quota.quotas.max_events,
      },
      offer: {
        left: Math.max(0, quota.quotas.max_active_offers - quota.offers),
        max: quota.quotas.max_active_offers,
        full: quota.offers >= quota.quotas.max_active_offers,
      },
    };
  }, [quota]);

  // Offers can only attach to APPROVED venues. Pending/rejected venues are
  // hidden from the picker; the type tile is blocked with a clear message.
  const approvedVenues = useMemo(
    () => (myVenues ?? []).filter((v: any) => v?.moderation_status === "approved"),
    [myVenues],
  );

  // Step 1 — pick kind
  if (open && step === 1) {
    const cards = (["venue", "event", "offer"] as const).map((k) => {
      const t = PARTNER_TEMPLATES[k];
      const q = quotaState[k];
      const full = q?.full;
      const blockedNoVenue = k === "offer" && myVenues.length === 0;
      const blockedNoApproved = k === "offer" && !blockedNoVenue && approvedVenues.length === 0;
      const blocked = blockedNoVenue || blockedNoApproved;
      return (
        <button
          key={k}
          type="button"
          disabled={full || blocked}
          onClick={() => {
            setKind(k);
            // pre-fill offer with first APPROVED venue
            if (k === "offer" && approvedVenues.length) {
              setValues({ venue_id: approvedVenues[0].id });
              if (approvedVenues[0].lat && approvedVenues[0].lng) {
                setLat(approvedVenues[0].lat);
                setLng(approvedVenues[0].lng);
              }
            }
            setStep(2);
          }}
          className="w-full text-left rounded-lg border p-4 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{t.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {t.label}
                {full && <Badge variant="destructive">Limită atinsă</Badge>}
                {blockedNoVenue && <Badge variant="secondary">Adaugă întâi un loc</Badge>}
                {blockedNoApproved && <Badge variant="secondary">Așteaptă aprobarea unui loc</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t.shortDescription}</p>
              <p className="text-xs text-muted-foreground mt-1 italic">{t.whenToUse}</p>
              {q && !full && (
                <div className="text-xs text-muted-foreground mt-2">
                  {q.left} din {q.max} disponibile
                </div>
              )}
              {full && (
                <a
                  href="/partner/billing"
                  className="text-xs text-primary underline mt-2 inline-block"
                >
                  Upgrade plan pentru limite mai mari →
                </a>
              )}
            </div>
            <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground" />
          </div>
        </button>
      );
    });

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Postare nouă — pas 1 din 5</DialogTitle>
            <DialogDescription>Ce vrei să postezi?</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">{cards}</div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Anulează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!template) return null;

  // Step 2 — details
  const detailsContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{template.shortDescription}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setValues({ ...template.example, ...values })}
        >
          <Lightbulb className="w-3 h-3 mr-1" /> Vezi exemplu
        </Button>
      </div>
      {template.fields.map((f) => (
        <FieldRenderer
          key={f.key}
          field={f}
          value={values[f.key]}
          onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
          extraOptions={
            f.key === "venue_id"
              ? myVenues.map((v) => ({ value: v.id, label: v.name }))
              : undefined
          }
          uploaderUserId={user?.id ?? ""}
        />
      ))}
    </div>
  );

  // Step 3 — location
  const showLocation = template.kind !== "offer";
  const locationContent = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Click pe hartă sau trage pin-ul roșu pentru a seta locația{" "}
        {template.kind === "venue" ? "locului" : "evenimentului"}.
      </p>
      <PinMap lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
      <div className="space-y-1">
        <Label className="flex items-center justify-between">
          <span>Rază notificare proximitate</span>
          <span className="font-medium">{(radius / 1000).toFixed(1)} km</span>
        </Label>
        <input
          type="range"
          min={MIN_RADIUS}
          max={MAX_RADIUS}
          step={100}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Utilizatorii la sub {(radius / 1000).toFixed(1)} km pot primi o notificare după
          aprobare — <strong>respectând limitele lor anti-spam</strong> (max 1 alertă per
          loc / 24h, plafon zilnic, ore liniștite). Tu nu controlezi aceste limite.
        </p>
      </div>
    </div>
  );

  // Step 4 — preview
  const previewContent = (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Cum apare în Nearby
        </Label>
        <NearbyPreviewCard
          template={template}
          values={values}
          radius={radius}
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Cum apare notificarea
        </Label>
        <div className="rounded-lg border bg-card p-3 text-sm flex items-start gap-2">
          <span>📍</span>
          <div className="flex-1">
            <div className="font-medium">
              {String(values.title || values.name || "Titlu...").slice(0, 60)}
            </div>
            <div className="text-xs text-muted-foreground">450m • Ventuza</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Validation for step 2
  const issues = validateTemplate(template, values);

  const onSubmit = async () => {
    if (issues.length) {
      toast.error(issues[0]);
      return;
    }
    setBusy(true);
    try {
      if (template.kind === "venue") {
        await createVenue({
          data: {
            name: String(values.name),
            category: values.category || null,
            description: values.description || null,
            address: values.address || null,
            city: values.city || null,
            lat,
            lng,
            cover_url: values.cover_url || null,
            website: values.website || null,
            phone_e164: values.phone_e164 || null,
          } as any,
        });
      } else if (template.kind === "event") {
        await createEvent({
          data: {
            title: String(values.title),
            description: values.description || null,
            event_type: values.event_type || "other",
            city: values.city || null,
            venue: values.venue || null,
            lat,
            lng,
            starts_at: new Date(values.starts_at).toISOString(),
            ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
            max_attendees: values.max_attendees ? Number(values.max_attendees) : null,
            cover_url: values.cover_url || null,
          } as any,
        });
      } else {
        await createOffer({
          data: {
            venue_id: String(values.venue_id),
            title: String(values.title),
            description: values.description || null,
            terms: values.terms || null,
            valid_from: values.valid_from ? new Date(values.valid_from).toISOString() : null,
            valid_to: values.valid_to ? new Date(values.valid_to).toISOString() : null,
            max_claims_per_user: values.max_claims_per_user
              ? Number(values.max_claims_per_user)
              : null,
          } as any,
        });
      }
      setStep(5);
      onCreated();
    } catch (e: any) {
      const msg = e?.message ?? "Eroare la trimitere";
      if (msg.startsWith("quota_exceeded")) {
        toast.error("Ai atins limita planului. Upgrade pentru limite mai mari.");
      } else if (msg.startsWith("rate_limited")) {
        toast.error("Prea multe drafts într-o oră. Așteaptă puțin.");
      } else if (msg.startsWith("suspended")) {
        toast.error("Cont suspendat. Contactează moderarea.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  // Step 5 — confirmation
  if (step === 5) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Trimis spre moderare ✓</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p>
              Postarea ta a intrat în coada de moderare. SLA: <strong>1–2 zile lucrătoare</strong>.
            </p>
            <p>
              Vei primi o notificare în portal cu decizia (aprobat, cere modificări sau respins
              cu motiv). După aprobare, postarea apare în Nearby și utilizatorii din rază pot
              primi o alertă (respectând limitele lor anti-spam).
            </p>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Înțeles</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const stepTitle = step === 2 ? "Detalii" : step === 3 ? "Locație" : "Previzualizare";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template.emoji} {template.label} — pas {step} din 5: {stepTitle}
          </DialogTitle>
          <DialogDescription>
            {step === 2 && "Completează detaliile. Câmpurile cu * sunt obligatorii."}
            {step === 3 && (showLocation ? "Setează unde se află." : "Oferta moștenește locația locului.")}
            {step === 4 && "Verifică exact cum vor vedea utilizatorii postarea ta."}
          </DialogDescription>
        </DialogHeader>

        {step === 2 && detailsContent}
        {step === 3 && (showLocation ? locationContent : <OfferLocationNote />)}
        {step === 4 && previewContent}

        {step === 2 && issues.length > 0 && (
          <div className="rounded border border-orange-500/30 bg-orange-500/5 p-2 text-xs text-orange-700 dark:text-orange-300 flex items-start gap-2">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Câmpuri de completat:</div>
              <ul className="list-disc pl-4">
                {issues.slice(0, 3).map((i) => (
                  <li key={i}>{i}</li>
                ))}
                {issues.length > 3 && <li>+ încă {issues.length - 3}…</li>}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 2 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={busy}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Înapoi
            </Button>
          )}
          {step < 4 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && issues.length > 0}
            >
              Continuă <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 4 && (
            <Button onClick={onSubmit} disabled={busy}>
              {busy ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              Trimite la moderare
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- FIELD RENDERER ---------------------------- */

function FieldRenderer({
  field,
  value,
  onChange,
  extraOptions,
  uploaderUserId,
}: {
  field: PartnerField;
  value: any;
  onChange: (v: any) => void;
  extraOptions?: Array<{ value: string; label: string }>;
  uploaderUserId: string;
}) {
  const counter =
    typeof value === "string" && (field.maxLength || field.minLength) ? (
      <span className="text-[10px] text-muted-foreground ml-auto">
        {value.length}
        {field.maxLength ? `/${field.maxLength}` : ""}
      </span>
    ) : null;

  const labelEl = (
    <Label className="flex items-center gap-2">
      <span>
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {counter}
    </Label>
  );

  const hintEl = field.hint && (
    <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>
  );

  if (field.type === "textarea") {
    return (
      <div>
        {labelEl}
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          rows={4}
        />
        {hintEl}
      </div>
    );
  }

  if (field.type === "select") {
    const opts = extraOptions ?? field.options ?? [];
    return (
      <div>
        {labelEl}
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder ?? "Alege..."} />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hintEl}
      </div>
    );
  }

  if (field.type === "image") {
    return (
      <div>
        {labelEl}
        <div className="flex items-center gap-3">
          {value ? (
            <img src={value} alt="" className="w-20 h-20 rounded object-cover bg-muted" />
          ) : (
            <div className="w-20 h-20 rounded bg-muted flex items-center justify-center">
              <ImgIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!f.type.startsWith("image/")) return toast.error("Doar imagini.");
              if (f.size > 5 * 1024 * 1024) return toast.error("Max 5 MB.");
              const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
              const path = `${uploaderUserId}/${crypto.randomUUID()}.${ext}`;
              const { error } = await supabase.storage
                .from("venue-media")
                .upload(path, f, { contentType: f.type, upsert: false });
              if (error) return toast.error(error.message);
              const { data } = await supabase.storage
                .from("venue-media")
                .createSignedUrl(path, 60 * 60 * 24 * 365);

              if (data?.signedUrl) onChange(data.signedUrl);
            }}
          />
        </div>
        {hintEl}
      </div>
    );
  }

  return (
    <div>
      {labelEl}
      <Input
        type={
          field.type === "number"
            ? "number"
            : field.type === "datetime-local"
              ? "datetime-local"
              : field.type === "url"
                ? "url"
                : "text"
        }
        value={value ?? ""}
        onChange={(e) =>
          onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
        }
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        min={field.min}
        max={field.max}
      />
      {hintEl}
    </div>
  );
}

function OfferLocationNote() {
  return (
    <div className="rounded border bg-muted/40 p-4 text-sm text-muted-foreground flex items-start gap-2">
      <MapPin className="w-4 h-4 mt-0.5" />
      <div>
        Oferta moștenește automat locația locului la care e atașată. Treci la pasul
        următor pentru preview.
      </div>
    </div>
  );
}

/* ------------------------------- PIN MAP --------------------------------- */

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

  return <div ref={ref} className="w-full h-56 rounded border" />;
}

/* ------------------------------- PREVIEW --------------------------------- */

function NearbyPreviewCard({
  template,
  values,
  radius,
}: {
  template: PartnerTemplate;
  values: Record<string, any>;
  radius: number;
}) {
  const title = String(values.title || values.name || "Titlul tău...");
  const subtitle = template.kind === "venue"
    ? `${values.category ?? ""}${values.city ? ` • ${values.city}` : ""}`
    : template.kind === "event"
      ? values.starts_at
        ? new Date(values.starts_at).toLocaleString("ro-RO")
        : "Data evenimentului"
      : "Ofertă";
  return (
    <Card>
      <CardContent className="pt-4 flex gap-3 items-start">
        {values.cover_url ? (
          <img src={values.cover_url} alt="" className="w-16 h-16 rounded object-cover bg-muted" />
        ) : (
          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
            <ImgIcon className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate flex items-center gap-2">
            <span>{template.emoji}</span>
            <span className="truncate">{title}</span>
          </div>
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Rază: {(radius / 1000).toFixed(1)} km
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px]">Preview</Badge>
      </CardContent>
    </Card>
  );
}
