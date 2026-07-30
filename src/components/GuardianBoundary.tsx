/**
 * Guardian Error Boundary — înlocuiește ecranul alb cu un fallback util.
 *
 * Se folosește la nivel de aplicație și pe zonele critice (chat, profil,
 * auth, matching, premium, setări, upload foto). Oferă: mesaj clar, Retry,
 * Înapoi, raportare automată către Guardian și păstrarea datelor introduse
 * (draft) unde componenta copil salvează în `sessionStorage`.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { capture } from "@/lib/guardian/collector";
import type { GuardianCategory } from "@/lib/guardian/core";

type Props = {
  /** Numele zonei: "app" | "chat" | "profile" | "auth" | ... */
  area: string;
  category?: GuardianCategory;
  children: ReactNode;
  /** Fallback custom; primește retry. */
  fallback?: (props: { error: Error; retry: () => void }) => ReactNode;
};

type State = { error: Error | null };

export class GuardianBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    capture({
      message: `[${this.props.area}] ${error.message}`,
      stack: `${error.stack ?? ""}\n${info.componentStack ?? ""}`,
      category: this.props.category ?? "react",
      severity: this.props.area === "app" ? "critical" : "high",
      context: { boundary: this.props.area },
    });
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback({ error, retry: this.retry });

    return (
      <div className="flex min-h-[240px] w-full items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
          <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            Ceva n-a mers bine aici
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Am salvat automat un raport tehnic (fără date personale) și echipa e notificată.
            Poți încerca din nou — datele introduse rămân salvate.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              onClick={this.retry}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <RefreshCw className="size-4" aria-hidden /> Încearcă din nou
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  if (window.history.length > 1) window.history.back();
                  else window.location.assign("/");
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden /> Înapoi
            </button>
          </div>
        </div>
      </div>
    );
  }
}
