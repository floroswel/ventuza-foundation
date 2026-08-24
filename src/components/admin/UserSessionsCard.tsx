/**
 * Sesiuni & dispozitive pentru un user (fișa User 360).
 * GDPR-safe: nu afișăm fingerprint brut, user agent complet sau endpoint push —
 * doar platformă derivată, referință hash-uită și timestamps.
 * Revocarea cere justificare ≥10 caractere, rol admin+ și MFA (server-side).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldOff, Smartphone } from "lucide-react";
import {
  adminListUserDevices,
  adminRevokePushSub,
  adminRevokeUserSessions,
} from "@/lib/admin-sessions.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function fmt(v: string | null) {
  return v ? new Date(v).toLocaleString("ro-RO") : "—";
}

export function UserSessionsCard({ userId }: { userId: string }) {
  const listFn = useServerFn(adminListUserDevices);
  const revokeFn = useServerFn(adminRevokeUserSessions);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["admin", "user-devices", userId],
    queryFn: async () => listFn({ data: { userId } }),
  });

  const revokePushFn = useServerFn(adminRevokePushSub);

  const revokePush = useMutation({
    mutationFn: async (subscriptionId: string) =>
      revokePushFn({ data: { userId, subscriptionId, reason: "admin device revoke" } }),
    onSuccess: () => {
      toast.success("Dispozitiv push revocat");
      void qc.invalidateQueries({ queryKey: ["admin", "user-devices", userId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Revocarea a eșuat"),
  });

  const revoke = useMutation({
    mutationFn: async () => revokeFn({ data: { userId, reason } }),
    onSuccess: () => {
      toast.success("Toate sesiunile au fost revocate");
      setOpen(false);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin", "user-devices", userId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Revocarea a eșuat"),
  });

  const devices = q.data?.devices ?? [];

  return (
    <section className="rounded-xl border border-border bg-surface/40 p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Smartphone className="size-4" /> Sesiuni & dispozitive
          </h3>
          <p className="text-xs text-muted-foreground">
            Date minimizate (GDPR): platformă și referință hash-uită, fără identificatori bruți.
          </p>
        </div>
        <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
          <ShieldOff className="mr-2 size-4" /> Revocă toate sesiunile
        </Button>
      </header>

      {q.isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Se încarcă…
        </div>
      ) : q.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {q.error instanceof Error && /forbidden|role|permission/i.test(q.error.message)
            ? `Acces refuzat — necesită rol admin. ${q.error.message}`
            : String(q.error)}
        </p>
      ) : devices.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Empty legitim: niciun dispozitiv sau abonament push înregistrat pentru acest cont.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left">Dispozitiv</th>
                <th className="px-2 py-1 text-left">Referință</th>
                <th className="px-2 py-1 text-left">Prima dată</th>
                <th className="px-2 py-1 text-left">Ultima activitate</th>
                <th className="px-2 py-1 text-left">Stare</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={`${d.kind}-${d.id}`} className="border-t border-border/50">
                  <td className="px-2 py-1">{d.label}</td>
                  <td className="px-2 py-1 font-mono">{d.ref}</td>
                  <td className="px-2 py-1">{fmt(d.firstSeenAt)}</td>
                  <td className="px-2 py-1">{fmt(d.lastSeenAt)}</td>
                  <td className="px-2 py-1">
                    {d.disabledAt ? (
                      <span className="text-muted-foreground">revocat</span>
                    ) : d.kind === "push" ? (
                      <button
                        type="button"
                        className="text-destructive underline disabled:opacity-50"
                        disabled={revokePush.isPending}
                        onClick={() => revokePush.mutate(d.id)}
                      >
                        revocă
                      </button>
                    ) : (
                      <span className="text-muted-foreground">activ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revocă toate sesiunile</DialogTitle>
            <DialogDescription>
              Userul va fi deconectat de pe toate dispozitivele, iar abonamentele push vor fi
              dezactivate. Acțiunea se loghează în audit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Justificare (min. 10 caractere)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 10 || revoke.isPending}
              onClick={() => revoke.mutate()}
            >
              {revoke.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Revocă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
