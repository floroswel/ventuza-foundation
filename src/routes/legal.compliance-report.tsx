import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Download, FileText } from "lucide-react";

import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";
import { ALL_CONSENT_KINDS, CONSENT_REGISTRY } from "@/lib/consent-registry";
import {
  SUBPROCESSORS_LAST_UPDATED,
  SUBPROCESSORS_VERSION,
  formatLegalDate,
} from "@/lib/legal-versions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/legal/compliance-report")({
  head: () => ({
    meta: [
      { title: "Raport de conformitate ANPC / GDPR — Suzeta" },
      {
        name: "description",
        content:
          "Raport exportabil cu textele legale publice Suzeta, linkurile lor, consimțămintele înregistrate și activitățile din registrul Art. 30 GDPR.",
      },
      { property: "og:title", content: "Raport de conformitate ANPC / GDPR — Suzeta" },
      {
        property: "og:description",
        content: "Verificare rapidă: ce e public, unde e linkul și ce conține registrul Art. 30.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.ro/legal/compliance-report" }],
  }),
  component: ComplianceReportPage,
});

type Doc = {
  title: string;
  path: string;
  requirement: string;
  scope: "GDPR" | "ANPC" | "DSA" | "Play Store";
};

const DOCS: Doc[] = [
  { title: "Termeni și condiții", path: "/legal/terms", requirement: "OUG 34/2014 · Legea 365/2002 · Art. 6(1)(b) GDPR", scope: "ANPC" },
  { title: "Politica de confidențialitate", path: "/legal/privacy", requirement: "Art. 13-14 GDPR", scope: "GDPR" },
  { title: "Politica de cookies", path: "/legal/cookies", requirement: "Art. 6(1)(a) GDPR · Legea 506/2004", scope: "GDPR" },
  { title: "Reguli de comunitate", path: "/legal/community", requirement: "DSA Art. 14 (termeni de moderare)", scope: "DSA" },
  { title: "Politica 18+", path: "/legal/age-policy", requirement: "Protecția minorilor · Play Store", scope: "Play Store" },
  { title: "Siguranța copiilor (CSAE)", path: "/legal/child-safety", requirement: "Google Play Child Safety Standards", scope: "Play Store" },
  { title: "Punct de contact DSA", path: "/legal/dsa", requirement: "DSA Art. 11, 16, 20", scope: "DSA" },
  { title: "Procedură DMCA", path: "/legal/dmca", requirement: "Directiva 2019/790 · DMCA", scope: "DSA" },
  { title: "Acord de prelucrare (DPA)", path: "/legal/dpa", requirement: "Art. 28 GDPR", scope: "GDPR" },
  { title: "Lista de subprocesatori", path: "/legal/subprocessors", requirement: "Art. 28(2) GDPR", scope: "GDPR" },
  { title: "Transferuri extra-UE", path: "/legal/transfers", requirement: "Art. 44-49 GDPR (SCC / DPF)", scope: "GDPR" },
  { title: "Registrul activităților (sumar Art. 30)", path: "/legal/records-of-processing", requirement: "Art. 30 GDPR", scope: "GDPR" },
  { title: "Incidente de securitate", path: "/legal/security-incidents", requirement: "Art. 33-34 GDPR", scope: "GDPR" },
  { title: "Formular cerere GDPR", path: "/legal/gdpr-request", requirement: "Art. 12 GDPR (canal de exercitare)", scope: "GDPR" },
  { title: "Centru de cereri GDPR (export + ștergere + status)", path: "/legal/gdpr-center", requirement: "Art. 15, 17, 20 GDPR", scope: "GDPR" },
  { title: "Siguranță utilizatori", path: "/safety", requirement: "Bune practici · Play Store", scope: "Play Store" },
  { title: "Termeni business / parteneri", path: "/legal/business-terms", requirement: "Contract B2B · ANPC (comerciant)", scope: "ANPC" },
  { title: "Termeni portofel (wallet)", path: "/legal/wallet-terms", requirement: "Transparență recompense · ANPC", scope: "ANPC" },
  { title: "Data safety (Play)", path: "/legal/data-safety", requirement: "Google Play Data Safety", scope: "Play Store" },
];

/** Activități de prelucrare — sumar aliniat cu docs/gdpr-art-30-register.md. */
const ART30 = [
  { activity: "Cont și profil utilizator", basis: "Art. 6(1)(b)", art9: "—", retention: "Până la ștergerea contului" },
  { activity: "Verificare vârstă 18+ (Didit)", basis: "Art. 6(1)(c)", art9: "Art. 9(2)(a)", retention: "Doar rezultat pass/fail; imaginea e ștearsă de procesator" },
  { activity: "Descoperire / matching pe distanță bucketizată", basis: "Art. 6(1)(b)", art9: "Art. 9(2)(a)", retention: "Până la ștergerea contului" },
  { activity: "Mesagerie și media", basis: "Art. 6(1)(b)", art9: "Art. 9(2)(a)", retention: "Până la ștergere / raportare" },
  { activity: "Moderare, raportări, siguranță", basis: "Art. 6(1)(f)", art9: "Art. 9(2)(g)", retention: "Max. 12 luni de la soluționare" },
  { activity: "Notificări push și proximitate", basis: "Art. 6(1)(a)", art9: "—", retention: "Până la retragerea consimțământului" },
  { activity: "Analitice și măsurarea instalărilor", basis: "Art. 6(1)(a)", art9: "—", retention: "13 luni" },
  { activity: "Facturare parteneri B2B", basis: "Art. 6(1)(c)", art9: "—", retention: "10 ani (Legea contabilității 82/1991)" },
  { activity: "Comenzi merch (producător + curier)", basis: "Art. 6(1)(b)", art9: "—", retention: "10 ani pentru documentele fiscale; adresa de livrare 12 luni" },
  { activity: "Cereri GDPR și ștergeri de cont", basis: "Art. 6(1)(c)", art9: "—", retention: "3 ani (dovada soluționării)" },
];

function ComplianceReportPage() {
  const generatedAt = useMemo(() => new Date(), []);
  const origin = "https://suzeta.ro";

  function buildMarkdown(): string {
    const lines: string[] = [];
    lines.push(`# Raport de conformitate ANPC / GDPR — ${OPERATOR.brand}`);
    lines.push("");
    lines.push(`Generat: ${generatedAt.toLocaleString("ro-RO")}`);
    lines.push(`Operator: ${OPERATOR.legalName} · DPO: ${OPERATOR.emails.dpo}`);
    lines.push(`Lista de subprocesatori: v${SUBPROCESSORS_VERSION} (${formatLegalDate(SUBPROCESSORS_LAST_UPDATED)})`);
    lines.push("");
    lines.push("## 1. Documente publice");
    lines.push("");
    lines.push("| Document | Link | Cerință |");
    lines.push("| --- | --- | --- |");
    for (const d of DOCS) lines.push(`| ${d.title} | ${origin}${d.path} | ${d.requirement} |`);
    lines.push("");
    lines.push("## 2. Consimțăminte înregistrate (consent_log)");
    lines.push("");
    lines.push("| Tip | Versiune | Obligatoriu | Art. 9 |");
    lines.push("| --- | --- | --- | --- |");
    for (const k of ALL_CONSENT_KINDS) {
      const m = CONSENT_REGISTRY[k];
      lines.push(`| ${m.label} (${m.kind}) | ${m.currentVersion} | ${m.required ? "da" : "nu"} | ${m.art9 ? "da" : "nu"} |`);
    }
    lines.push("");
    lines.push("## 3. Registrul activităților de prelucrare (Art. 30)");
    lines.push("");
    lines.push("| Activitate | Temei Art. 6 | Temei Art. 9 | Retenție |");
    lines.push("| --- | --- | --- | --- |");
    for (const a of ART30) lines.push(`| ${a.activity} | ${a.basis} | ${a.art9} | ${a.retention} |`);
    lines.push("");
    lines.push("## 4. Drepturi și canale");
    lines.push("");
    lines.push(`- Export date și ștergere cont self-service: ${origin}/legal/gdpr-center`);
    lines.push(`- Cerere scrisă cu ticket: ${origin}/legal/gdpr-request`);
    lines.push(`- Contact DPO: ${OPERATOR.emails.dpo}`);
    lines.push("- Autoritate de supraveghere: ANSPDCP · Protecția consumatorului: ANPC / SOL");
    return lines.join("\n");
  }

  function buildCsv(): string {
    const rows: string[][] = [["sectiune", "element", "link_sau_temei", "detaliu"]];
    for (const d of DOCS) rows.push(["document_public", d.title, `${origin}${d.path}`, d.requirement]);
    for (const k of ALL_CONSENT_KINDS) {
      const m = CONSENT_REGISTRY[k];
      rows.push(["consimtamant", m.label, m.currentVersion, `required=${m.required};art9=${m.art9}`]);
    }
    for (const a of ART30) rows.push(["art30", a.activity, `${a.basis} / ${a.art9}`, a.retention]);
    return rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  function download(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stamp = generatedAt.toISOString().slice(0, 10);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Raport conformitate ANPC / GDPR</h1>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">
          Generat: {generatedAt.toLocaleString("ro-RO")} · listă subprocesatori v
          {SUBPROCESSORS_VERSION} ({formatLegalDate(SUBPROCESSORS_LAST_UPDATED)})
        </p>

        <div className="mt-4">
          <OperatorIdentificationBlock compact />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => download(buildMarkdown(), `suzeta-conformitate-${stamp}.md`, "text/markdown")}
          >
            <FileText className="mr-2 size-4" /> Export Markdown
          </Button>
          <Button
            variant="outline"
            onClick={() => download(buildCsv(), `suzeta-conformitate-${stamp}.csv`, "text/csv")}
          >
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        </div>

        <h2 className="mt-8 text-base font-semibold">1. Documente publice</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">Document</th>
                <th className="px-3 py-2 text-left">Link</th>
                <th className="px-3 py-2 text-left">Cerință</th>
              </tr>
            </thead>
            <tbody>
              {DOCS.map((d) => (
                <tr key={d.path} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">
                    {d.title}
                    <div className="mt-1">
                      <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {d.scope}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <a className="text-primary underline" href={d.path}>
                      {d.path}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.requirement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-base font-semibold">2. Consimțăminte înregistrate</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">Tip</th>
                <th className="px-3 py-2 text-left">Versiune</th>
                <th className="px-3 py-2 text-left">Obligatoriu</th>
                <th className="px-3 py-2 text-left">Art. 9</th>
              </tr>
            </thead>
            <tbody>
              {ALL_CONSENT_KINDS.map((k) => {
                const m = CONSENT_REGISTRY[k];
                return (
                  <tr key={k} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      {m.label}
                      <div className="font-mono text-[10px] text-muted-foreground">{m.kind}</div>
                    </td>
                    <td className="px-3 py-2">{m.currentVersion}</td>
                    <td className="px-3 py-2">{m.required ? "da" : "nu"}</td>
                    <td className="px-3 py-2">{m.art9 ? "da" : "nu"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-base font-semibold">3. Registrul Art. 30 (sumar)</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">Activitate</th>
                <th className="px-3 py-2 text-left">Temei Art. 6</th>
                <th className="px-3 py-2 text-left">Temei Art. 9</th>
                <th className="px-3 py-2 text-left">Retenție</th>
              </tr>
            </thead>
            <tbody>
              {ART30.map((a) => (
                <tr key={a.activity} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">{a.activity}</td>
                  <td className="px-3 py-2">{a.basis}</td>
                  <td className="px-3 py-2">{a.art9}</td>
                  <td className="px-3 py-2 text-muted-foreground">{a.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Versiunea completă a registrului Art. 30 este ținută intern
          (docs/gdpr-art-30-register.md) și se transmite ANSPDCP doar la cerere. Sumarul public
          este la{" "}
          <Link to="/legal/records-of-processing" className="text-primary underline">
            /legal/records-of-processing
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
