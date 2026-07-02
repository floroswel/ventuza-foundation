// Sprint A — badge care arată dacă itemul e revendicat de altcineva sau de tine
import { Lock, UserCheck } from "lucide-react";

export function ClaimBadge({
  claim,
  meId,
}: {
  claim?: { actor_id: string; display_name: string; expires_at: string } | null;
  meId?: string;
}) {
  if (!claim) return null;
  const mine = claim.actor_id === meId;
  return (
    <span
      title={mine ? "Revendicat de tine" : `Revendicat de ${claim.display_name}, expiră ${new Date(claim.expires_at).toLocaleTimeString("ro-RO")}`}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
        mine
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-orange-500/40 bg-orange-500/10 text-orange-200"
      }`}
    >
      {mine ? <UserCheck className="size-2.5" /> : <Lock className="size-2.5" />}
      {mine ? "al tău" : claim.display_name}
    </span>
  );
}
