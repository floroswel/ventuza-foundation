import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CONSENT_REGISTRY } from "@/lib/consent-registry";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/verify")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Verificare 18+ — Ventuza" },
      {
        name: "description",
        content: "Trimite selfie-urile de liveness pentru verificarea internă 18+ Ventuza.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyPage,
});

type AgeStatus = "unverified" | "pending" | "verified" | "failed" | "expired" | null;
type RequestStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "needs_second"
  | "appeal"
  | "expired";

type LatestRequest = {
  id: string;
  status: RequestStatus;
  reason: string | null;
  reason_code: string | null;
  submitted_at: string;
  decided_at: string | null;
};

const CHALLENGE_LABELS: Record<string, string> = {
  blink: "Clipește clar spre cameră",
  smile: "Zâmbește natural",
  turn_head_left: "Întoarce capul spre stânga",
  turn_head_right: "Întoarce capul spre dreapta",
  raise_left_hand: "Ridică mâna stângă",
  raise_right_hand: "Ridică mâna dreaptă",
  touch_nose: "Atinge-ți nasul",
  touch_left_ear: "Atinge urechea stângă",
  touch_right_ear: "Atinge urechea dreaptă",
  show_two_fingers: "Arată două degete",
};

function VerifyPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ageStatus, setAgeStatus] = useState<AgeStatus>(null);
  const [latestRequest, setLatestRequest] = useState<LatestRequest | null>(null);
  const [challenges, setChallenges] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Array<string | null>>([null, null, null]);
  const [consentAccepted, setConsentAccepted] = useState(false);

  const activeIndex = useMemo(() => {
    const idx = photos.findIndex((photo) => !photo);
    return idx === -1 ? 2 : idx;
  }, [photos]);

  const completed = photos.filter(Boolean).length;
  const isPending = ageStatus === "pending" || latestRequest?.status === "pending" || latestRequest?.status === "in_review" || latestRequest?.status === "needs_second";
  const isRejected = ageStatus === "failed" || latestRequest?.status === "rejected" || latestRequest?.status === "expired" || latestRequest?.status === "appeal";

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    let alive = true;
    async function load() {
      setLoading(true);
      const [profileRes, requestRes, challengeRes] = await Promise.all([
        supabase.from("profiles").select("age_status").eq("id", uid).maybeSingle(),
        supabase
          .from("verification_requests")
          .select("id,status,reason,reason_code,submitted_at,decided_at")
          .eq("user_id", uid)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("verification_generate_challenges"),
      ]);

      if (!alive) return;
      setAgeStatus((profileRes.data?.age_status as AgeStatus) ?? "unverified");
      setLatestRequest((requestRes.data as LatestRequest | null) ?? null);

      if (challengeRes.error) {
        setCameraError(challengeRes.error.message);
      } else if (Array.isArray(challengeRes.data)) {
        setChallenges(challengeRes.data.map(String).slice(0, 3));
      }
      setLoading(false);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || loading || ageStatus === "verified" || isPending) return;
    let stopped = false;
    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera nu este disponibilă în browserul acesta. Poți încărca pozele manual.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
          setCameraError(null);
        }
      } catch (error) {
        setCameraReady(false);
        setCameraError(
          error instanceof Error
            ? error.message
            : "Nu am putut porni camera. Poți încărca pozele manual.",
        );
      }
    }
    void startCamera();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraReady(false);
    };
  }, [user?.id, loading, ageStatus, isPending]);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;
    const width = video.videoWidth || 960;
    const height = video.videoHeight || 1280;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setPhotos((prev) => prev.map((photo, idx) => (idx === activeIndex ? dataUrl : photo)));
  }

  function onFilePicked(index: number, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Alege o imagine validă.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => prev.map((photo, idx) => (idx === index ? String(reader.result) : photo)));
    };
    reader.readAsDataURL(file);
  }

  async function dataUrlToBlob(dataUrl: string) {
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function submit() {
    if (!user || challenges.length !== 3 || photos.some((photo) => !photo) || !consentAccepted) return;
    setSubmitting(true);
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null;
      const { error: consentError } = await supabase.rpc("record_consent", {
        _kind: "internal_verification",
        _version: CONSENT_REGISTRY.internal_verification.currentVersion,
        _accepted: true,
        _user_agent: ua ?? undefined,
      });
      if (consentError) throw consentError;

      const timestamp = Date.now();
      const paths: string[] = [];
      for (let i = 0; i < photos.length; i += 1) {
        const blob = await dataUrlToBlob(photos[i]!);
        const path = `${user.id}/${timestamp}-${i + 1}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("verification")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw uploadError;
        paths.push(path);
      }

      const { data: requestId, error: submitError } = await supabase.rpc("verification_submit_request", {
        p_challenges: challenges,
        p_image_paths: paths,
        p_ip_hash: undefined,
        p_ua_hash: ua ?? undefined,
        p_country: undefined,
      });
      if (submitError) throw submitError;

      setAgeStatus("pending");
      setLatestRequest({
        id: String(requestId),
        status: "pending",
        reason: null,
        reason_code: null,
        submitted_at: new Date().toISOString(),
        decided_at: null,
      });
      toast.success("Verificarea a fost trimisă.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verificarea nu a putut fi trimisă.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <Loader2 className="size-7 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) return null;

  if (ageStatus === "verified" || latestRequest?.status === "approved") {
    return (
      <main className="min-h-screen bg-background px-5 pb-10 pt-[max(env(safe-area-inset-top),1.25rem)] text-foreground">
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
          <div className="grid size-20 place-items-center rounded-full border border-primary/30 bg-primary/10">
            <BadgeCheck className="size-10 text-primary" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Cont verificat</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Ai deja verificarea 18+ activă și poți folosi Discover, mesageria și restul funcțiilor sociale.
          </p>
          <Button asChild className="mt-8 w-full">
            <Link to="/discover">Continuă</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (isPending) {
    return (
      <main className="min-h-screen bg-background px-5 pb-10 pt-[max(env(safe-area-inset-top),1.25rem)] text-foreground">
        <div className="mx-auto max-w-md">
          <BackLink />
          <div className="mt-16 text-center">
            <div className="mx-auto grid size-20 place-items-center rounded-full border border-amber-500/30 bg-amber-500/10">
              <Loader2 className="size-9 animate-spin text-amber-300" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">Verificare în curs</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Am primit selfie-urile tale. Un moderator intern le verifică și vei primi notificare când decizia este gata.
            </p>
            <div className="mt-6 rounded-2xl border border-border/70 bg-surface/40 p-4 text-left text-sm text-muted-foreground">
              <p>Status: {latestRequest?.status === "in_review" ? "în review" : "în așteptare"}</p>
              {latestRequest?.submitted_at && (
                <p className="mt-1">Trimisă: {new Date(latestRequest.submitted_at).toLocaleString("ro-RO")}</p>
              )}
            </div>
            <Button asChild variant="outline" className="mt-8 w-full">
              <Link to="/account">Înapoi la cont</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-10 text-foreground">
      <div className="mx-auto max-w-md px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <BackLink />

        <header className="mt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" /> 18+ intern
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Verificare</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Fă 3 selfie-uri cu gesturile cerute. Imaginile sunt private, verificate intern și șterse după perioada legală de retenție.
          </p>
        </header>

        {isRejected && (
          <div className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 size-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Verificarea anterioară nu a fost aprobată.</p>
                <p className="mt-1 text-muted-foreground">
                  {latestRequest?.reason || "Poți trimite o cerere nouă cu lumină mai bună și fața clar vizibilă."}
                </p>
              </div>
            </div>
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-surface/40">
          <div className="relative aspect-[3/4] bg-muted">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            {!cameraReady && (
              <div className="absolute inset-0 grid place-items-center px-6 text-center">
                <div>
                  <Camera className="mx-auto size-10 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {cameraError ?? "Se pornește camera…"}
                  </p>
                </div>
              </div>
            )}
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-background/40 bg-background/85 p-4 shadow-xl backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pasul {activeIndex + 1} din 3
              </p>
              <p className="mt-1 text-lg font-semibold">
                {CHALLENGE_LABELS[challenges[activeIndex]] ?? "Pregătește selfie-ul"}
              </p>
              <Button type="button" onClick={capturePhoto} disabled={!cameraReady} className="mt-3 w-full">
                <Camera className="size-4" /> Capturează
              </Button>
            </div>
          </div>
        </section>

        <canvas ref={canvasRef} className="hidden" />

        <section className="mt-5 grid grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-border/70 bg-surface/40">
              <div className="relative aspect-square bg-muted">
                {photo ? (
                  <img src={photo} alt={`Selfie ${index + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center px-2 text-center text-xs text-muted-foreground">
                    {CHALLENGE_LABELS[challenges[index]] ?? `Selfie ${index + 1}`}
                  </div>
                )}
                {photo && (
                  <button
                    type="button"
                    aria-label={`Refă selfie ${index + 1}`}
                    onClick={() => setPhotos((prev) => prev.map((p, i) => (i === index ? null : p)))}
                    className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-background/85 text-foreground shadow"
                  >
                    <RefreshCw className="size-4" />
                  </button>
                )}
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-1.5 px-2 py-2 text-xs text-muted-foreground">
                <FileImage className="size-3.5" /> Încarcă
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="sr-only"
                  onChange={(event) => onFilePicked(index, event.target.files?.[0])}
                />
              </label>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-border/70 bg-surface/40 p-4">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={consentAccepted}
              onCheckedChange={(checked) => setConsentAccepted(checked === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed text-muted-foreground">
              Sunt de acord cu prelucrarea selfie-urilor pentru verificarea internă 18+. Datele biometrice sunt folosite doar pentru verificare și nu sunt vândute sau folosite pentru publicitate.
            </span>
          </label>
        </section>

        <Button
          type="button"
          size="lg"
          onClick={submit}
          disabled={submitting || completed !== 3 || !consentAccepted || challenges.length !== 3}
          className="mt-5 w-full"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Trimite verificarea
        </Button>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          Review manual, fără procesator KYC extern.
        </div>
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link to="/account" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <ArrowLeft className="size-4" /> Cont
    </Link>
  );
}