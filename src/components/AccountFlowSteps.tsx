/**
 * Afișează starea contului nou: confirmare email → profil → verificare 18+,
 * cu pasul curent evidențiat și recomandări clare pentru pasul următor.
 */
import { CheckCircle2, CircleDashed, Loader2, Lock } from "lucide-react";
import type { AccountFlowSummary, AccountFlowStep } from "@/lib/account-flow";
import { ResendConfirmationButton } from "@/components/ResendConfirmationButton";

function StepIcon({ state }: { state: AccountFlowStep["state"] }) {
  if (state === "done") return <CheckCircle2 className="size-5 text-emerald-400" aria-hidden="true" />;
  if (state === "current") return <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />;
  if (state === "blocked") return <Lock className="size-5 text-muted-foreground" aria-hidden="true" />;
  return <CircleDashed className="size-5 text-muted-foreground" aria-hidden="true" />;
}

export function AccountFlowSteps({
  summary,
  email,
  className,
}: {
  summary: AccountFlowSummary;
  email?: string | null;
  className?: string;
}) {
  const emailStep = summary.steps.find((s) => s.id === "email");
  return (
    <section
      className={`rounded-2xl border border-border bg-surface/50 p-4 ${className ?? ""}`}
      aria-label="Stare verificare cont"
    >
      <p className="text-sm font-semibold text-foreground">{summary.headline}</p>
      <ol className="mt-3 space-y-3">
        {summary.steps.map((step, i) => (
          <li key={step.id} className="flex gap-3">
            <div className="pt-0.5">
              <StepIcon state={step.state} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={
                  step.state === "current"
                    ? "text-sm font-semibold text-foreground"
                    : "text-sm font-medium text-muted-foreground"
                }
              >
                {i + 1}. {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
              {step.nextAction && step.state !== "blocked" && (
                <p className="mt-1 text-xs text-primary">{step.nextAction}</p>
              )}
              {step.nextAction && step.state === "blocked" && (
                <p className="mt-1 text-xs text-muted-foreground/80">{step.nextAction}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {emailStep?.state === "current" && (
        <ResendConfirmationButton email={email} className="mt-4" />
      )}
    </section>
  );
}
