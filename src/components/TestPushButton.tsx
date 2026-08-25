/**
 * Test rapid de livrare push, declanșat de utilizator.
 *
 * Verifică lanțul complet: token salvat în `push_subscriptions` → FCM /
 * Web Push → handler pe device. Funcționează identic cu aplicația deschisă
 * (handler foreground → toast + sunet) și închisă (notificare de sistem pe
 * canalul corect, tap → deep link).
 */
import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { sendTestPush } from "@/lib/push.functions";

export function TestPushButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const run = useServerFn(sendTestPush);

  async function send() {
    setBusy(true);
    try {
      const r = await run({ data: { kind: "message" } });
      if (r.delivered > 0) {
        toast.success(`Notificare de test trimisă (${r.delivered}).`, {
          description:
            "Cu aplicația deschisă apare aici; cu aplicația închisă apare în bara de notificări. Atinge notificarea ca să verifici deep link-ul.",
          duration: 8000,
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
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={busy}
      onClick={send}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <BellRing className="mr-2 h-4 w-4" />
      )}
      Trimite notificare de test
    </Button>
  );
}
