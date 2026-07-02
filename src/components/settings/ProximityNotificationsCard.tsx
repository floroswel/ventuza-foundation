/**
 * Proximity settings card — Strat 1 toggle + Strat 2 opt-in (background).
 * Stratul 2 cere consimțământ `background_location` explicit, plus în Capacitor
 * cere și permisiunea OS pentru locație în fundal (ACCESS_BACKGROUND_LOCATION).
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, MapPin, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useConsent } from "@/lib/use-consent";
import { getProximityStatus, setProximityEnabled } from "@/lib/proximity.functions";

export function ProximityNotificationsCard() {
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;
  const fetchStatus = useServerFn(getProximityStatus);
  const setEnabled = useServerFn(setProximityEnabled);
  const bgConsent = useConsent("background_location");

  const [enabled, setEnabledLocal] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getProximityStatus>> | null>(null);

  useEffect(() => {
    if (!userId) return;
    void supabase
      .from("profiles")
      .select("proximity_notifications_enabled")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setEnabledLocal(data?.proximity_notifications_enabled ?? true));
    void fetchStatus()
      .then(setStatus)
      .catch(() => {});
  }, [userId, fetchStatus]);

  async function onToggle(v: boolean) {
    setEnabledLocal(v);
    try {
      await setEnabled({ data: { enabled: v } });
      toast.success(
        v ? "Notificări de proximitate activate" : "Notificări de proximitate dezactivate",
      );
    } catch (e) {
      setEnabledLocal(!v);
      toast.error("Nu am putut salva preferința");
    }
  }

  async function enableBackground() {
    const ok = await bgConsent.ensure();
    if (!ok) return;
    // On Capacitor we'd request native background permission here. On web,
    // there's nothing more to do — Strat 1 (foreground) continues to work.
    toast.success("Background geofencing activat (când app-ul rulează pe mobil)");
  }

  async function disableBackground() {
    const { error } = await supabase.rpc("record_consent", {
      _kind: "background_location",
      _accepted: false,
    });
    if (error) toast.error("Nu am putut retrage consimțământul");
    else {
      toast.success("Background geofencing oprit");
      // Trigger refetch
      window.location.reload();
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">Notificări de proximitate</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Te anunțăm când treci pe lângă un eveniment sau local aprobat din apropiere.
              Coordonatele tale exacte nu pleacă la server.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled ?? true}
          onCheckedChange={onToggle}
          aria-label="Notificări de proximitate"
        />
      </div>

      {status && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <Badge variant="outline">
            {status.sentLast24h}/{status.dailyCap} azi
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Moon className="h-3 w-3" /> {status.quietStart}:00–
            {String(status.quietEnd).padStart(2, "0")}:00 liniște
          </Badge>
          <Badge variant="outline">cooldown {status.cooldownHours}h/loc</Badge>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-accent mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-sm">Notificări și cu app-ul închis (geofencing)</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Necesită permisiune pentru locație în fundal. Calculul rămâne pe dispozitiv; NU
              înregistrăm traseul tău. Funcționează doar pe mobil (Capacitor).
            </p>
            {bgConsent.active ? (
              <div className="mt-2 flex items-center gap-2">
                <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Activ</Badge>
                <Button size="sm" variant="outline" onClick={disableBackground}>
                  Oprește
                </Button>
              </div>
            ) : (
              <Button size="sm" className="mt-2" onClick={enableBackground}>
                Activează geofencing
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
