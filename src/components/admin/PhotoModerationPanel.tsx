/**
 * Coadă de moderare pentru pozele de profil.
 * Poza devine publică DOAR după aprobare aici (vezi photo-moderation.functions.ts).
 * Pattern obligatoriu: loading / error / empty legitim.
 */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ImageOff, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListPhotoReviews,
  adminReviewPhotos,
  adminInviteVerification,
} from "@/lib/photo-moderation.functions";
import { GlassCard, SectionTitle } from "@/components/admin/ui/primitives";
import { AdminErrorBanner } from "@/components/admin/AdminErrorBanner";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  user_id: string;
  storage_path: string;
  status: string;
  ai_reason: string | null;
  created_at: string;
  url: string | null;
  profile: { display_name: string | null; age_status: string | null; verified: boolean } | null;
};

export function PhotoModerationPanel() {
  const list = useServerFn(adminListPhotoReviews);
  const review = useServerFn(adminReviewPhotos);
  const invite = useServerFn(adminInviteVerification);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await list({ data: { status, limit: 60 } });
      setRows((res?.rows ?? []) as Row[]);
      setSelected({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [list, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const ids = Object.keys(selected).filter((k) => selected[k]);

  async function decide(decision: "approve" | "reject", targetIds?: string[]) {
    const use = targetIds ?? ids;
    if (!use.length) return;
    let reason: string | undefined;
    if (decision === "reject") {
      const r = window.prompt("Motiv respingere (vizibil userului):", "Conținut nud / sexual");
      if (r === null) return;
      reason = r;
    }
    setBusy(true);
    try {
      const res: any = await review({ data: { ids: use, decision, reason } });
      toast.success(`${res.ok} ${decision === "approve" ? "aprobate" : "respinse"}.`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function inviteSelected(all = false) {
    const userIds = Array.from(new Set(rows.filter((r) => selected[r.id]).map((r) => r.user_id)));
    if (!all && !userIds.length) {
      toast.error("Selectează cel puțin o poză.");
      return;
    }
    setBusy(true);
    try {
      const res: any = await invite({ data: { userIds, allUnverified: all } });
      toast.success(`Invitații trimise: ${res.sent}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Poze de verificat</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
            >
              {s === "pending" ? "În așteptare" : s === "approved" ? "Aprobate" : "Respinse"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1 size-3.5" /> Reîncarcă
          </Button>
        </div>
      </div>

      {error && <AdminErrorBanner error={error} onRetry={() => void load()} />}

      <GlassCard className="flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs text-muted-foreground">
          Selectate: {ids.length} / {rows.length}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setSelected(
              ids.length === rows.length
                ? {}
                : Object.fromEntries(rows.map((r) => [r.id, true])),
            )
          }
        >
          {ids.length === rows.length && rows.length > 0 ? "Deselectează tot" : "Selectează tot"}
        </Button>
        {status === "pending" && (
          <>
            <Button size="sm" disabled={busy || !ids.length} onClick={() => void decide("approve")}>
              <CheckCircle2 className="mr-1 size-3.5" /> Aprobă
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || !ids.length}
              onClick={() => void decide("reject")}
            >
              <XCircle className="mr-1 size-3.5" /> Respinge
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void inviteSelected()}>
          <Send className="mr-1 size-3.5" /> Invită la verificare (selectați)
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Trimiți invitație la verificare tuturor userilor neverificați?"))
              void inviteSelected(true);
          }}
        >
          <Send className="mr-1 size-3.5" /> Invită toți neverificații
        </Button>
      </GlassCard>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
          <ImageOff className="size-6" />
          empty legitim — nicio poză în această stare.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
          {rows.map((r) => (
            <GlassCard key={r.id} className="overflow-hidden p-0">
              <button
                type="button"
                onClick={() => setSelected((s) => ({ ...s, [r.id]: !s[r.id] }))}
                className={`relative block aspect-[3/4] w-full ${
                  selected[r.id] ? "ring-2 ring-primary" : ""
                }`}
              >
                {r.url ? (
                  <img src={r.url} alt="Poză profil în verificare" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-xs text-muted-foreground">
                    fără preview
                  </div>
                )}
              </button>
              <div className="space-y-1 p-2 text-[11px]">
                <p className="truncate font-medium">{r.profile?.display_name ?? "—"}</p>
                <p className="truncate text-muted-foreground">
                  {r.profile?.age_status ?? "?"} · {new Date(r.created_at).toLocaleDateString("ro-RO")}
                </p>
                {status === "pending" && (
                  <div className="flex gap-1 pt-1">
                    <Button
                      size="sm"
                      className="h-7 flex-1 text-[11px]"
                      disabled={busy}
                      onClick={() => void decide("approve", [r.id])}
                    >
                      Aprobă
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 flex-1 text-[11px]"
                      disabled={busy}
                      onClick={() => void decide("reject", [r.id])}
                    >
                      Respinge
                    </Button>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
