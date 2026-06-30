/**
 * ReasonDialog — componentă comună pentru orice mutație admin care
 * cere justificare ≥ 10 caractere. Justificarea pleacă în
 * `admin_audit_log.justification` (append-only) prin server fn.
 *
 * Conform AGENTS.md → REGULĂ — ADMIN (justification obligatoriu,
 * audit before→after, gated rol+MFA server-side). Această componentă e
 * doar surface UI; refuzul real e în server fn.
 */
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ReasonDialogProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  fields?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  minLen?: number;
  onConfirm: (reason: string) => Promise<void>;
};

export function ReasonDialog({
  trigger, title, description, fields, confirmLabel = "Confirmă",
  destructive = false, minLen = 10, onConfirm,
}: ReasonDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (reason.trim().length < minLen) {
      toast.error(`Justificarea trebuie să aibă cel puțin ${minLen} caractere.`);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      toast.success("Acțiune executată.");
      setOpen(false);
      setReason("");
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          {fields}
          <div>
            <Label htmlFor="reason" className="text-sm">
              Justificare (obligatorie, min. {minLen} caractere) <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: ticket #1234, decizie moderare, Art. 16 GDPR rectificare"
              rows={3} className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Salvată în <code>admin_audit_log</code> (append-only). Vizibilă pentru auditor/super_admin.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Anulează</Button>
          <Button onClick={submit} disabled={busy} variant={destructive ? "destructive" : "default"}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
