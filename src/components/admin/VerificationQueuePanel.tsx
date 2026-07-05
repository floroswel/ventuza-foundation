import { AlertTriangle } from "lucide-react";
import { GlassCard, SectionTitle } from "@/components/admin/ui/primitives";

/**
 * DEPRECATED — coada internă de moderare 18+ nu mai este activă.
 *
 * Din iulie 2026 verificarea vârstei se face exclusiv prin Didit (procesator
 * UE) — fluxul intern (liveness + moderator) a fost dezactivat la cererea
 * business-ului. Tabelele `verification_requests` / `verification_images`
 * rămân în DB pentru audit istoric, dar nu se mai populează.
 *
 * Panoul rămâne montat DOAR ca placeholder informativ până la
 * curățenia finală, ca linkurile vechi din navigare admin să nu 404-eze.
 */
export function VerificationQueuePanel() {
  return (
    <div className="space-y-4">
      <SectionTitle>Verificare 18+</SectionTitle>
      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-400">
            <AlertTriangle className="size-5" />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="text-base font-semibold text-foreground">
              Coada internă de moderare este dezactivată.
            </p>
            <p>
              Verificarea vârstei se face acum exclusiv prin <strong>Didit</strong>. Selfie-urile
              nu mai ajung la moderatori umani, iar cererile noi nu se mai populează în
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">verification_requests</code>.
            </p>
            <p>
              Statusul fiecărui user este vizibil în tabela
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">didit_sessions</code>
              și pe <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">profiles.age_status</code>.
              Datele istorice rămân accesibile prin Data Explorer pentru audit.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
