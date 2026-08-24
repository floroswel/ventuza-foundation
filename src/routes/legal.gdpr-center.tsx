import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Cookie,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { useAuth } from "@/lib/auth-context";
import { openCookieSettings } from "@/components/CookieBanner";
import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/legal/gdpr-center")({
  head: () => ({
    meta: [
      { title: "Centru de cereri GDPR — export date și ștergere cont | Suzeta" },
      {
        name: "description",
        content:
          "Cere exportul datelor tale sau ștergerea contului Suzeta, urmărește statusul fiecărei cereri și gestionează consimțămintele pentru cookies.",
      },
      { property: "og:title", content: "Centru de cereri GDPR — Suzeta" },
      {
        property: "og:description",
        content: "Export de date, ștergere cont și status live pentru fiecare cerere GDPR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.ro/legal/gdpr-center" }],
  }),
  component: GdprCenterPage,
});

type RequestRow = {
  id: string;
  source: "gdpr" | "deletion";
  ticket: string;
  kind: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  new: { label: "Primită", tone: "bg-sky-500/15 text-sky-600" },
  open: { label: "Primită", tone: "bg-sky-500/15 text-sky-600" },
  pending: { label: "În așteptare", tone: "bg-amber-500/15 text-amber-600" },
  in_progress: { label: "În lucru", tone: "bg-amber-500/15 text-amber-600" },
  processing: { label: "În lucru", tone: "bg-amber-500/15 text-amber-600" },
  resolved: { label: "Soluționată", tone: "bg-emerald-500/15 text-emerald-600" },
  completed: { label: "Finalizată", tone: "bg-emerald-500/15 text-emerald-600" },
  done: { label: "Finalizată", tone: "bg-emerald-500/15 text-emerald-600" },
  rejected: { label: "Respinsă", tone: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Anulată", tone: "bg-muted text-muted-foreground" },
};

function statusChip(status: string) {
  return STATUS_LABEL[status] ?? { label: status, tone: "bg-muted text-muted-foreground" };
}

const KIND_LABEL: Record<string, string> = {
  access: "Acces la date (Art. 15)",
  rectification: "Rectificare (Art. 16)",
  erasure: "Ștergere (Art. 17)",
  deletion: "Ștergere cont (Art. 17)",
  restriction: "Restricționare (Art. 18)",
  portability: "Portabilitate (Art. 20)",
  objection: "Opoziție (Art. 21)",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" });
}

/** Termen legal GDPR: 30 de zile de la înregistrarea cererii. */
function deadline(created: string) {
  const dt = new Date(created);
  dt.setDate(dt.getDate() + 30);
  return dt.toLocaleDateString("ro-RO", { dateStyle: "medium" });
}

function GdprCenterPage() {
  const { user } = useAuth();
  const runExport = useServerFn(exportMyData);
  const runDelete = useServerFn(deleteMyAccount);

  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      return;
    }
    setLoadError(null);
    const [gdpr, del] = await Promise.all([
      supabase
        .from("gdpr_requests")
        .select("id, ticket_code, kind, status, created_at, resolved_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("deletion_requests")
        .select("id, status, requested_at, processed_at")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false }),
    ]);
    if (gdpr.error || del.error) {
      setLoadError(gdpr.error?.message ?? del.error?.message ?? "Eroare necunoscută");
      setRows([]);
      return;
    }
    const merged: RequestRow[] = [
      ...(gdpr.data ?? []).map((r) => ({
        id: r.id as string,
        source: "gdpr" as const,
        ticket: (r.ticket_code as string) ?? "—",
        kind: (r.kind as string) ?? "access",
        status: (r.status as string) ?? "new",
        createdAt: r.created_at as string,
        resolvedAt: (r.resolved_at as string | null) ?? null,
      })),
      ...(del.data ?? []).map((r) => ({
        id: r.id as string,
        source: "deletion" as const,
        ticket: `DEL-${String(r.id).slice(0, 8).toUpperCase()}`,
        kind: "deletion",
        status: (r.status as string) ?? "pending",
        createdAt: r.requested_at as string,
        resolvedAt: (r.processed_at as string | null) ?? null,
      })),
    ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    setRows(merged);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onExport() {
    setBusy("export");
    try {
      const data = await runExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suzeta-date-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportul a fost descărcat.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Exportul a eșuat.");
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (confirmText.trim().toUpperCase() !== "STERGE") {
      toast.error("Scrie STERGE pentru a confirma.");
      return;
    }
    setBusy("delete");
    try {
      await runDelete();
      await supabase.auth.signOut();
      toast.success("Contul a fost șters definitiv.");
      window.location.href = "/";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ștergerea a eșuat.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Centru de cereri GDPR</h1>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-muted-foreground">
          De aici îți poți descărca datele, poți cere ștergerea contului și poți urmări statusul
          fiecărei cereri. Termenul legal de răspuns este de <strong>30 de zile</strong> de la
          înregistrare (Art. 12 alin. 3 GDPR), cu posibilitate de prelungire motivată.
        </p>

        <div className="mt-4">
          <OperatorIdentificationBlock compact />
        </div>

        <section className="mt-6">
          <h2 className="text-base font-semibold">Cum funcționează, pas cu pas</h2>
          <ol className="mt-2 space-y-2 text-xs text-muted-foreground">
            <li>
              <strong className="text-foreground">1. Alegi acțiunea</strong> — export imediat,
              ștergere cont sau o cerere scrisă (rectificare, restricționare, opoziție).
            </li>
            <li>
              <strong className="text-foreground">2. Primești un număr de ticket</strong> —
              cererile scrise apar mai jos cu status și termen.
            </li>
            <li>
              <strong className="text-foreground">3. Verificăm identitatea</strong> — dacă e
              nevoie, îți scriem pe adresa de email a contului (fără copii de acte).
            </li>
            <li>
              <strong className="text-foreground">4. Soluționăm și te anunțăm</strong> — statusul
              devine „Soluționată”, iar răspunsul ajunge pe email.
            </li>
          </ol>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <div className="flex items-center gap-2">
              <Download className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Export date (Art. 15 &amp; 20)</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Descarci imediat un fișier JSON cu profilul, mesajele trimise, consimțămintele,
              match-urile și abonamentele tale. Nu conține date despre alți utilizatori și nici
              coordonate GPS.
            </p>
            <Button
              className="mt-3 w-full"
              onClick={onExport}
              disabled={!user || busy !== null}
            >
              {busy === "export" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Descarcă datele mele
            </Button>
            {!user && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Trebuie să fii autentificat.{" "}
                <Link to="/auth" className="text-primary underline">
                  Conectează-te
                </Link>
                .
              </p>
            )}
          </div>

          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              <h3 className="text-sm font-semibold">Ștergere cont (Art. 17)</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Ștergere definitivă și imediată: profil, poze, mesaje, match-uri. Păstrăm doar
              minimul cerut de lege (jurnal de audit al ștergerii, facturi fiscale). Nu se poate
              anula.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Scrie STERGE"
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
              aria-label="Confirmare ștergere cont"
            />
            <Button
              variant="destructive"
              className="mt-2 w-full"
              onClick={onDelete}
              disabled={!user || busy !== null}
            >
              {busy === "delete" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Șterge contul definitiv
            </Button>
          </div>
        </section>

        <section className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/legal/gdpr-request"
            className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface/70"
          >
            Altă cerere (rectificare, opoziție…)
          </Link>
          <button
            type="button"
            onClick={openCookieSettings}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface/70"
          >
            <Cookie className="size-3.5" /> Setări cookies
          </button>
          <Link
            to="/legal/subprocessors"
            className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface/70"
          >
            Subprocesatori
          </Link>
          <Link
            to="/legal/compliance-report"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface/70"
          >
            <ShieldCheck className="size-3.5" /> Raport conformitate
          </Link>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Cererile mele</h2>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px]"
            >
              <RefreshCw className="size-3" /> Reîncarcă
            </button>
          </div>

          {loadError ? (
            <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              Nu am putut încărca cererile: {loadError}
            </div>
          ) : !user ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Conectează-te pentru a vedea statusul cererilor tale.
            </p>
          ) : rows === null ? (
            <p className="mt-3 text-xs text-muted-foreground">Se încarcă…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 rounded-xl border border-border bg-surface/40 p-3 text-xs text-muted-foreground">
              Nu ai nicio cerere înregistrată (empty legitim). Când trimiți una, apare aici cu
              numărul de ticket și statusul ei.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-3 py-2 text-left">Ticket</th>
                    <th className="px-3 py-2 text-left">Tip</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Trimisă</th>
                    <th className="px-3 py-2 text-left">Termen / soluționare</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const chip = statusChip(r.status);
                    return (
                      <tr key={`${r.source}-${r.id}`} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-mono">{r.ticket}</td>
                        <td className="px-3 py-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${chip.tone}`}
                          >
                            {chip.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">{fmt(r.createdAt)}</td>
                        <td className="px-3 py-2">
                          {r.resolvedAt ? fmt(r.resolvedAt) : `până la ${deadline(r.createdAt)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Nemulțumit de răspuns? Ne poți scrie la{" "}
          <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
            {OPERATOR.emails.dpo}
          </a>{" "}
          sau te poți adresa ANSPDCP (autoritatea de supraveghere) și ANPC pentru aspecte de
          protecția consumatorului.
        </p>
      </main>
    </div>
  );
}
