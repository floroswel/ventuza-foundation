/**
 * AdminErrorBanner — banner unificat de eroare pentru toate panourile admin.
 *
 * Trei variante, un singur comportament de retry (buton „Reîncearcă" cu stare `busy`):
 *  - variant="fatal" (default): banner mare roșu, folosit când NU avem date de afișat.
 *    Detectează automat mesajele de tip forbidden/denied/rol și le etichetează
 *    „Acces refuzat" cu un hint despre rolul lipsă.
 *  - variant="soft": banner compact roșu, folosit când refresh-ul a eșuat dar
 *    avem încă date vechi vizibile („se afișează ultimele date reușite").
 *  - variant="warning": banner compact galben pentru probleme parțiale
 *    (ex: praguri SLA neîncărcate, fallback pe valori implicite).
 *
 * Respectă REGULA — ADMIN PANELS din AGENTS.md: eroarea este vizibilă, are
 * mesaj real, buton de reîncercare și nu se confundă cu empty legitim.
 */
import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

const FORBIDDEN_RE = /forbidden|denied|insufficient|not allowed|rol|role|policy|permission/i;

export function isForbiddenError(msg: string | null | undefined): boolean {
  return !!msg && FORBIDDEN_RE.test(msg);
}

export type AdminErrorBannerProps = {
  error: string;
  variant?: "fatal" | "soft" | "warning";
  /** Titlu personalizat pentru variantele fatal (default: „Eroare la încărcare" sau „Acces refuzat"). */
  title?: string;
  /** Text sub eroare doar când forbidden=true (ex: rolul minim necesar). */
  forbiddenHint?: ReactNode;
  /** Text scurt pentru variantele soft/warning înainte de mesajul de eroare (ex: „Refresh eșuat"). */
  softLead?: ReactNode;
  onRetry?: () => void;
  busy?: boolean;
  /** Override detecția automată de forbidden (util pentru variantele soft/warning). */
  forbidden?: boolean;
};

export function AdminErrorBanner({
  error,
  variant = "fatal",
  title,
  forbiddenHint,
  softLead,
  onRetry,
  busy = false,
  forbidden: forbiddenProp,
}: AdminErrorBannerProps) {
  const forbidden = forbiddenProp ?? (variant === "fatal" && isForbiddenError(error));

  if (variant === "warning") {
    return (
      <div
        className="rounded-xl border px-3 py-2 text-[11px]"
        style={{
          borderColor: "color-mix(in oklab, var(--warning) 40%, transparent)",
          background: "color-mix(in oklab, var(--warning) 8%, transparent)",
          color: "color-mix(in oklab, var(--warning) 85%, white)",
        }}
      >
        <AlertTriangle className="mr-1 inline size-3.5" />
        {softLead ?? "Avertisment"} ({error})
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={busy}
            className="ml-2 underline hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Reîncearcă"}
          </button>
        )}
      </div>
    );
  }

  if (variant === "soft") {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="mr-1 inline size-3.5" />
        {softLead ?? "Refresh eșuat — se afișează ultimele date reușite."}
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={busy}
            className="ml-1 underline hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Se reîncearcă…" : "Reîncearcă"}
          </button>
        )}
        <span className="ml-2 text-destructive/70">({error})</span>
      </div>
    );
  }

  // fatal
  const Icon = forbidden ? ShieldAlert : AlertTriangle;
  const heading = title ?? (forbidden ? "Acces refuzat" : "Eroare la încărcare");
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <Icon className="size-4" />
        </span>
        <div className="flex-1">
          <p className="font-display font-semibold tracking-tight text-destructive">{heading}</p>
          <p className="mt-1 break-words text-xs leading-relaxed text-destructive/85">{error}</p>
          {forbidden && forbiddenHint && (
            <p className="mt-2 text-[11px] text-destructive/70">{forbiddenHint}</p>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={busy}
              className="mt-3 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              {busy ? "Se reîncearcă…" : "Reîncearcă"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
