/**
 * PanelStatus — afișează stările loading / error / empty în mod CONSISTENT
 * pentru fiecare tab din panoul admin.
 *
 * REGULĂ AGENTS.md → "REGULĂ — ADMIN PANELS":
 *  - loading: spinner explicit + mesaj (nu rămâne agățat).
 *  - error: afișează EROAREA, nu empty fals.
 *  - empty: mesaj distinct doar când query-ul a reușit și a întors 0 rânduri.
 *  - „forbidden": detectat automat (Forbidden / 403) și afișat ca explicație de rol.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, ShieldAlert, Inbox } from "lucide-react";

export type PanelState<T> =
  | { status: "loading" }
  | { status: "error"; error: string; forbidden?: boolean }
  | { status: "ready"; data: T };

export function useAdminPanelLoad<T>(
  loader: () => Promise<T>,
  deps: any[] = [],
  opts: { timeoutMs?: number } = {},
): [PanelState<T>, () => void] {
  const [state, setState] = useState<PanelState<T>>({ status: "loading" });
  const tick = useRef(0);

  const run = () => {
    const myTick = ++tick.current;
    setState({ status: "loading" });
    const timeout = setTimeout(() => {
      if (tick.current !== myTick) return;
      setState({
        status: "error",
        error: `Cererea a depășit ${Math.round((opts.timeoutMs ?? 20000) / 1000)}s fără răspuns.`,
      });
    }, opts.timeoutMs ?? 20000);

    loader()
      .then((data) => {
        if (tick.current !== myTick) return;
        clearTimeout(timeout);
        setState({ status: "ready", data });
      })
      .catch((e: any) => {
        if (tick.current !== myTick) return;
        clearTimeout(timeout);
        const msg = e?.message ?? String(e ?? "Eroare necunoscută");
        const forbidden = /forbidden|denied|insufficient|not allowed|rol|role/i.test(msg);
        setState({ status: "error", error: msg, forbidden });
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);

  return [state, run];
}

export function PanelStatus({
  state, isEmpty, emptyHint, retry, children,
}: {
  state: PanelState<any>;
  isEmpty?: boolean;
  emptyHint?: string;
  retry?: () => void;
  children?: ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Se încarcă…
      </div>
    );
  }
  if (state.status === "error") {
    const Icon = state.forbidden ? ShieldAlert : AlertTriangle;
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-semibold text-red-300">
              {state.forbidden ? "Acces refuzat" : "Eroare la încărcare"}
            </p>
            <p className="mt-1 break-words text-xs text-red-200/90">{state.error}</p>
            {state.forbidden && (
              <p className="mt-2 text-[11px] text-red-200/70">
                Acest panou necesită un rol pe care contul tău nu îl are
                (ex: <code>super_admin</code> sau <code>auditor</code>).
              </p>
            )}
            {retry && (
              <button
                onClick={retry}
                className="mt-2 rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
              >
                Reîncearcă
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        <Inbox className="mx-auto mb-2 size-5 opacity-60" />
        {emptyHint ?? "Niciun rând. Datele apar aici când există."}
      </div>
    );
  }
  return <>{children}</>;
}
