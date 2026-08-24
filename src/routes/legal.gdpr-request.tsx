import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/legal/gdpr-request")({
  head: () => ({
    meta: [
      { title: "Cerere GDPR (acces, ștergere, rectificare) — Suzeta" },
      {
        name: "description",
        content:
          "Trimite o cerere GDPR către echipa de protecția datelor Suzeta: acces, ștergere, rectificare, portabilitate, opoziție sau restricționare. Primești un număr de ticket pentru urmărire.",
      },
      { property: "og:title", content: "Cerere GDPR — Suzeta" },
      {
        property: "og:description",
        content: "Formular oficial pentru exercitarea drepturilor GDPR, cu număr de ticket.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.ro/legal/gdpr-request" }],
  }),
  component: GdprRequestPage,
});

const KINDS = [
  { value: "access", label: "Acces la date (Art. 15)", team: "Protecția datelor (DPO)" },
  { value: "rectification", label: "Rectificare (Art. 16)", team: "Protecția datelor (DPO)" },
  { value: "erasure", label: "Ștergere / „dreptul de a fi uitat” (Art. 17)", team: "Protecția datelor (DPO)" },
  { value: "restriction", label: "Restricționarea prelucrării (Art. 18)", team: "Protecția datelor (DPO)" },
  { value: "portability", label: "Portabilitatea datelor (Art. 20)", team: "Protecția datelor (DPO)" },
  { value: "objection", label: "Opoziție la prelucrare (Art. 21)", team: "Protecția datelor (DPO)" },
  { value: "other", label: "Altă solicitare privind datele", team: "Protecția datelor (DPO)" },
] as const;

const schema = z.object({
  kind: z.enum(["access", "rectification", "erasure", "restriction", "portability", "objection", "other"]),
  contact_email: z
    .string()
    .trim()
    .email({ message: "Adresă de email invalidă." })
    .max(255, { message: "Emailul trebuie să aibă sub 255 de caractere." }),
  full_name: z
    .string()
    .trim()
    .max(120, { message: "Numele trebuie să aibă sub 120 de caractere." })
    .optional(),
  details: z
    .string()
    .trim()
    .max(4000, { message: "Descrierea trebuie să aibă sub 4000 de caractere." })
    .optional(),
});

type Ticket = { code: string; kind: string; email: string };

function GdprRequestPage() {
  const [kind, setKind] = useState<string>("access");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse({
      kind,
      contact_email: email,
      full_name: name || undefined,
      details: details || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Date invalide.");
      return;
    }

    setBusy(true);
    try {
      const { data, error: rpcError } = await (supabase.rpc as never as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: { ticket_code: string }[] | null; error: { message: string } | null }>)(
        "submit_gdpr_request",
        {
          _kind: parsed.data.kind,
          _contact_email: parsed.data.contact_email,
          _full_name: parsed.data.full_name ?? null,
          _details: parsed.data.details ?? null,
        },
      );

      if (rpcError) {
        const msg = rpcError.message || "";
        if (msg.includes("gdpr_rate_limited")) {
          throw new Error(
            "Ai trimis prea multe cereri în ultima oră. Încearcă din nou mai târziu sau scrie direct la " +
              OPERATOR.emails.dpo +
              ".",
          );
        }
        if (msg.includes("invalid_email")) throw new Error("Adresă de email invalidă.");
        throw new Error("Nu am putut înregistra cererea. Încearcă din nou.");
      }

      const code = data?.[0]?.ticket_code;
      if (!code) throw new Error("Nu am primit numărul de ticket. Încearcă din nou.");

      setTicket({ code, kind: parsed.data.kind, email: parsed.data.contact_email });
      toast.success("Cererea a fost înregistrată.");
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  const selected = KINDS.find((k) => k.value === kind);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Cerere GDPR</h1>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        {ticket ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="size-5" />
              <h2 className="text-base font-semibold">Cererea a fost înregistrată</h2>
            </div>
            <p className="mt-3 text-sm">
              Numărul tău de ticket, pentru urmărirea cererii:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-base font-semibold">
                {ticket.code}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(ticket.code);
                  toast.success("Ticket copiat.");
                }}
              >
                <Copy className="mr-1 size-4" /> Copiază
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Cererea a fost direcționată către echipa de protecția datelor ({OPERATOR.emails.dpo}).
              Îți răspundem la <strong>{ticket.email}</strong> în cel mult 30 de zile de la primire
              (art. 12 alin. 3 GDPR), cu posibilitatea unei prelungiri motivate de încă două luni
              pentru cereri complexe. Poate fi necesar să îți verificăm identitatea înainte de a
              furniza datele.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Păstrează numărul de ticket și menționează-l în orice corespondență ulterioară.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTicket(null);
                  setDetails("");
                }}
              >
                Trimite altă cerere
              </Button>
              <Button asChild size="sm">
                <a href={`mailto:${OPERATOR.emails.dpo}?subject=${encodeURIComponent(ticket.code)}`}>
                  Scrie echipei DPO
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p>
              Folosește acest formular ca să îți exerciți drepturile prevăzute de GDPR față de{" "}
              <strong>{OPERATOR.legalName}</strong>, operatorul aplicației {OPERATOR.brand}. Cererea
              ajunge direct la echipa responsabilă și primești imediat un număr de ticket pentru
              urmărire.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="kind">Tipul cererii *</Label>
                <select
                  id="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
                {selected && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Se direcționează către: {selected.team}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email de contact *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="numele@exemplu.ro"
                  maxLength={255}
                  className="mt-1"
                  required
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ideal, folosește adresa asociată contului — grăbește verificarea identității.
                </p>
              </div>

              <div>
                <Label htmlFor="name">Nume (opțional)</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="details">Detalii (opțional)</Label>
                <Textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="Descrie pe scurt ce anume soliciți (ex: ce date vrei rectificate)."
                  className="mt-1"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Nu include date sensibile care nu sunt necesare cererii (ex. date de sănătate).
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Trimite cererea
              </Button>
            </form>

            <h2 className="mt-8 text-base font-semibold">Ce urmează</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              <li>Primești un număr de ticket imediat după trimitere.</li>
              <li>Răspundem în maximum 30 de zile (art. 12 alin. 3 GDPR).</li>
              <li>
                Pentru cereri complexe putem prelungi termenul cu până la două luni, cu informare
                prealabilă.
              </li>
              <li>
                Serviciul este gratuit; putem percepe un tarif rezonabil doar pentru cereri vădit
                nefondate sau excesive (art. 12 alin. 5).
              </li>
              <li>
                Ai dreptul să depui plângere la ANSPDCP (
                <a
                  className="text-primary"
                  href="https://www.dataprotection.ro"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  dataprotection.ro
                </a>
                ).
              </li>
            </ul>

            <p className="mt-4 text-xs text-muted-foreground">
              Alternativ, poți scrie direct la{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
                {OPERATOR.emails.dpo}
              </a>
              . Vezi și{" "}
              <Link className="text-primary" to="/legal/privacy">
                Politica de confidențialitate
              </Link>
              .
            </p>

            <div className="mt-6">
              <OperatorIdentificationBlock compact />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
