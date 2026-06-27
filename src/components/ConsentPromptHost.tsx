import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Singleton host pentru cererea de consimțământ unificată.
 * Înlocuiește `window.confirm()` (interzis pentru Art. 7 GDPR — trebuie UI propriu
 * cu titlu, descriere și acțiuni clare). Folosit prin `requestConsent(meta)`
 * din `src/lib/use-consent.ts`.
 */

type Meta = { label: string; description: string };
type Req = { meta: Meta; resolve: (v: boolean) => void };

let push: ((r: Req) => void) | null = null;

export function requestConsent(meta: Meta): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) {
      // Host nu e montat încă — refuză sigur (default deny).
      resolve(false);
      return;
    }
    push({ meta, resolve });
  });
}

export function ConsentPromptHost() {
  const [queue, setQueue] = useState<Req[]>([]);
  const current = queue[0];

  useEffect(() => {
    push = (r) => setQueue((q) => [...q, r]);
    return () => { push = null; };
  }, []);

  const close = (ok: boolean) => {
    if (!current) return;
    current.resolve(ok);
    setQueue((q) => q.slice(1));
  };

  return (
    <Dialog open={!!current} onOpenChange={(o) => { if (!o) close(false); }}>
      <DialogContent className="max-w-md">
        {current && (
          <>
            <DialogHeader>
              <DialogTitle>{current.meta.label}</DialogTitle>
              <DialogDescription className="whitespace-pre-line text-left">
                {current.meta.description}
                {"\n\n"}Poți retrage oricând din Setări → Consimțăminte.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => close(false)}>Nu acum</Button>
              <Button variant="hero" onClick={() => close(true)}>Activează</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
