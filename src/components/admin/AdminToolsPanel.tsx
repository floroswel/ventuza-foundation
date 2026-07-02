/**
 * EXTRA CRITICE — Admin tools panel.
 *
 *  - Redactare mesaj individual (în convo raportată).
 *  - Editare directă venue/event partener (telefon, adresă etc.).
 *  - Anulare factură (storno + reemitere).
 *
 * Datele Art. 9 NU se proiectează aici (break-glass only).
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eraser, Building2, FileMinus, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ReasonDialog } from "./ReasonDialog";
import {
  adminRedactMessage,
  adminUpdatePartnerItem,
  adminVoidInvoice,
} from "@/lib/admin-content.functions";

const UUID = /^[0-9a-f-]{36}$/i;

export function AdminToolsPanel() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Unelte admin (operaționale)</h2>
      <RedactMessageCard />
      <EditPartnerItemCard />
      <VoidInvoiceCard />
    </div>
  );
}

function RedactMessageCard() {
  const [id, setId] = useState("");
  const fn = useServerFn(adminRedactMessage);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Eraser className="h-4 w-4 text-amber-400" />
        <h3 className="font-medium">Redactare mesaj individual</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Înlocuiește textul cu „[REDACTED]”, șterge media/voice, marchează `deleted_at`. Contextul
        conversației rămâne intact. Snapshot original păstrat doar în
        <code className="px-1">admin_audit_log</code>.
      </p>
      <div>
        <Label>Message ID (uuid)</Label>
        <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="ex: ee5a…" />
      </div>
      <div className="flex justify-end">
        <ReasonDialog
          trigger={
            <Button variant="destructive" size="sm">
              <Eraser className="h-4 w-4 mr-1" /> Redactează
            </Button>
          }
          title="Redactare mesaj"
          destructive
          confirmLabel="Redactează"
          onConfirm={async (reason) => {
            if (!UUID.test(id.trim())) throw new Error("Message ID invalid (uuid)");
            await fn({ data: { messageId: id.trim(), justification: reason } });
            toast.success("Mesaj redactat");
            setId("");
          }}
        />
      </div>
    </Card>
  );
}

function EditPartnerItemCard() {
  const [kind, setKind] = useState<"venue" | "event">("venue");
  const [id, setId] = useState("");
  // venue fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  // event fields
  const [title, setTitle] = useState("");
  const [venueText, setVenueText] = useState("");
  const [description, setDescription] = useState("");

  const fn = useServerFn(adminUpdatePartnerItem);

  function buildChanges() {
    if (kind === "venue") {
      const c: Record<string, string> = {};
      if (name.trim()) c.name = name.trim();
      if (phone.trim()) c.phone_e164 = phone.trim();
      if (address.trim()) c.address = address.trim();
      if (website.trim()) c.website = website.trim();
      if (description.trim()) c.description = description.trim();
      return c;
    }
    const c: Record<string, string> = {};
    if (title.trim()) c.title = title.trim();
    if (venueText.trim()) c.venue = venueText.trim();
    if (description.trim()) c.description = description.trim();
    return c;
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-blue-400" />
        <h3 className="font-medium">Editare directă venue / event partener</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Corecție de încredere (telefon greșit, adresă etc.). NU re-trigger-uiește moderarea. Trece
        complet prin audit log (vechi → nou).
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Tip</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="venue">venue</SelectItem>
              <SelectItem value="event">event</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Item ID (uuid)</Label>
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="ex: a7b1…" />
        </div>
      </div>

      {kind === "venue" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nume</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Telefon E.164</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+40…" />
          </div>
          <div className="col-span-2">
            <Label>Adresă</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Descriere</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Titlu</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Venue (text)</Label>
            <Input value={venueText} onChange={(e) => setVenueText(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Descriere</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <ReasonDialog
          trigger={
            <Button size="sm">
              <Save className="h-4 w-4 mr-1" /> Salvează
            </Button>
          }
          title="Editare directă (staff)"
          confirmLabel="Salvează"
          onConfirm={async (reason) => {
            if (!UUID.test(id.trim())) throw new Error("Item ID invalid (uuid)");
            const changes = buildChanges();
            if (Object.keys(changes).length === 0) throw new Error("Niciun câmp completat");
            await fn({
              data: { kind, itemId: id.trim(), changes: changes as any, justification: reason },
            });
            toast.success("Item actualizat");
          }}
        />
      </div>
    </Card>
  );
}

function VoidInvoiceCard() {
  const [id, setId] = useState("");
  const fn = useServerFn(adminVoidInvoice);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileMinus className="h-4 w-4 text-rose-400" />
        <h3 className="font-medium">Anulare factură (storno + reemitere)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Inserează o factură storno cu totaluri negative, păstrează snapshot-ul fiscal IMUTABIL și
        marchează originalul `voided`. Rezervat super_admin.
      </p>
      <div>
        <Label>Invoice ID (uuid)</Label>
        <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="ex: c1a2…" />
      </div>
      <div className="flex justify-end">
        <ReasonDialog
          trigger={
            <Button variant="destructive" size="sm">
              <FileMinus className="h-4 w-4 mr-1" /> Anulează
            </Button>
          }
          title="Anulare factură (storno)"
          destructive
          confirmLabel="Anulează"
          onConfirm={async (reason) => {
            if (!UUID.test(id.trim())) throw new Error("Invoice ID invalid (uuid)");
            const r: any = await fn({ data: { invoiceId: id.trim(), justification: reason } });
            toast.success(
              `Storno emis ${r?.storno?.series}-${r?.storno?.year}-${String(r?.storno?.number ?? "").padStart(6, "0")}`,
            );
            setId("");
          }}
        />
      </div>
    </Card>
  );
}
