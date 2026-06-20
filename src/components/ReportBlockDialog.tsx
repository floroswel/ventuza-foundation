import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";

const REASONS = [
  { id: "fake", label: "Profil fals / poze furate" },
  { id: "harassment", label: "Hărțuire sau limbaj abuziv" },
  { id: "spam", label: "Spam sau reclamă" },
  { id: "inappropriate", label: "Conținut sexual neconsimțit" },
  { id: "underage", label: "Minor (sub 18 ani)" },
  { id: "scam", label: "Înșelătorie / scam financiar" },
  { id: "other", label: "Altceva" },
];

export function ReportBlockDialog({
  targetUserId,
  targetName,
  trigger,
  onBlocked,
}: {
  targetUserId: string;
  targetName?: string;
  trigger?: React.ReactNode;
  onBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(alsoBlock: boolean) {
    if (!reason) return toast.error("Alege un motiv");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return toast.error("Nu ești autentificat"); }
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_id: targetUserId,
      reason,
      details: details || null,
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    if (alsoBlock) {
      await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: targetUserId });
      onBlocked?.();
    }
    setBusy(false);
    setOpen(false);
    setReason(""); setDetails("");
    toast.success(alsoBlock ? "Raportat și blocat" : "Mulțumim, am primit raportul");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
            <Flag className="size-3" /> Raportează
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Raportează {targetName ?? "utilizatorul"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {REASONS.map((r) => (
            <label key={r.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${reason === r.id ? "border-primary bg-primary/10" : "border-border"}`}>
              <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-primary" />
              {r.label}
            </label>
          ))}
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Detalii (opțional)"
            rows={2}
            className="w-full rounded-xl border border-border bg-background p-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2 pt-2">
            <button disabled={busy} onClick={() => submit(false)} className="flex-1 rounded-full border border-border px-3 py-2 text-xs font-medium disabled:opacity-50">
              {busy && <Loader2 className="mr-1 inline size-3 animate-spin" />} Doar raportează
            </button>
            <button disabled={busy} onClick={() => submit(true)} className="flex-1 rounded-full bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground disabled:opacity-50">
              Raportează + Blochează
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
