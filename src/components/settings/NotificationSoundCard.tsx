/**
 * Toggle pentru semnătura sonoră Suzeta redată la notificări noi.
 * Sunetul este generat 100% în cod (Web Audio API), fără fișiere externe.
 * Preferința se persistă în localStorage — nu pleacă la server.
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
  playNotificationSound,
} from "@/lib/notification-sound";

export function NotificationSoundCard() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isNotificationSoundEnabled());
  }, []);

  const toggle = (v: boolean) => {
    setEnabled(v);
    setNotificationSoundEnabled(v);
    if (v) playNotificationSound();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-fuchsia-500/10 p-2 text-fuchsia-500">
            <Volume2 className="size-4" />
          </div>
          <div>
            <p className="font-medium">Sunet notificare</p>
            <p className="text-sm text-muted-foreground">
              Semnătura sonoră Suzeta — două note discrete, redate la mesaje și
              activitate nouă.
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} aria-label="Sunet notificare" />
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => playNotificationSound()}
          disabled={!enabled}
        >
          Ascultă
        </Button>
      </div>
    </Card>
  );
}
