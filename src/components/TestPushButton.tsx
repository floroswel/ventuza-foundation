/**
 * Test rapid de livrare push, declanșat de utilizator.
 *
 * Verifică lanțul complet: token salvat în `push_subscriptions` → FCM /
 * Web Push → handler pe device, în ambele scenarii:
 *
 *  - „Acum” (aplicație DESCHISĂ): `pushNotificationReceived` → toast + sunet.
 *  - „În 15s” (aplicație ÎNCHISĂ): întârzierea este SERVER-SIDE, pentru că un
 *    timer pe client moare odată cu procesul aplicației. Utilizatorul are timp
 *    să închidă aplicația și să vadă notificarea de sistem pe canalul corect;
 *    tap → deep link (`pushNotificationActionPerformed`, inclusiv cold start).
 */
import { useState } from "react";
import { BellRing, Loader2, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { sendTestPush } from "@/lib/push.functions";

const CLOSED_APP_DELAY = 15;

export function TestPushButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState<"now" | "delayed" | null>(null);
  const [countdown, setCountdown] = useState(0);
  const run = useServerFn(sendTestPush);

  async function send(mode: "now" | "delayed") {
    setBusy(mode);
    const delaySeconds = mode === "delayed" ? CLOSED_APP_DELAY : 0;
    if (delaySeconds) {
      setCountdown(delaySeconds);
      const iv = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(iv);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      toast.info(`Notificarea pleacă în ${delaySeconds} secunde.`, {
        description: "Închide acum aplicația ca să verifici notificarea de sistem.",
        duration: delaySeconds * 1000,
      });
    }
    try {
      const r = await run({ data: { kind: "message", delaySeconds } });
      if (r.delivered > 0) {
        toast.success(`Notificare de test trimisă (${r.delivered}).`, {
          description: `Canal Android: ${r.channel}. Dispozitive abonate: ${r.subscriptions} (FCM: ${r.fcm}, web: ${r.webpush}). Atinge notificarea ca să verifici deep link-ul spre Mesaje.`,
          duration: 9000,
        });
      } else if (r.subscriptions === 0) {
        toast.error("Nu există niciun dispozitiv abonat.", {
          description: "Activează mai întâi notificările de pe acest dispozitiv.",
        });
      } else if (!r.fcmConfigured && r.webpush === 0) {
        toast.error("Serviciul de notificări nu e configurat pe server.");
      } else {
        toast.error("Notificarea nu a putut fi livrată.", {
          description: "Abonarea poate fi expirată — dezactivează și reactivează notificările.",
        });
      }
    } catch {
      toast.error("Testul a eșuat. Încearcă din nou.");
    } finally {
      setBusy(null);
      setCountdown(0);
    }
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() => send("now")}
      >
        {busy === "now" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <BellRing className="mr-2 h-4 w-4" />
        )}
        Test acum (aplicație deschisă)
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() => send("delayed")}
      >
        {busy === "delayed" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <TimerReset className="mr-2 h-4 w-4" />
        )}
        {busy === "delayed" && countdown > 0
          ? `Trimit în ${countdown}s — închide aplicația`
          : `Test în ${CLOSED_APP_DELAY}s (aplicație închisă)`}
      </Button>
    </div>
  );
}
