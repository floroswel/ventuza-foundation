// Client-side export helpers for the Risk dashboard.
// CSV: a single multi-section file. PDF: print-friendly HTML opened in a new tab
// where the browser's native print dialog (Save as PDF) handles the rendering —
// no extra dependency required.

type Row = (string | number | null | undefined)[];

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: Row[]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ts(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type RiskExportInput = {
  windowHours: number;
  filters: {
    search: string;
    scoreBucket: string;
    userStatus: string;
    flagStatus: string;
    flagKind: string;
    fingerprintQuery: string;
    fingerprintMatches: number | null;
  };
  generatedAt: string;
  summary: Record<string, number | string>;
  distribution: { bucket: string; count: number }[];
  kinds: { kind: string; count: number; avg_severity: number }[];
  topUsers: {
    user_id: string;
    display_name: string | null;
    risk_score: number;
    report_count: number;
    verified: boolean;
    banned_at: string | null;
    suspended_until: string | null;
    created_at: string;
  }[];
  recentFlags: {
    id: string;
    created_at: string;
    kind: string;
    severity: number;
    status: string;
    user_id: string;
    display_name: string | null;
  }[];
};

function filtersLine(f: RiskExportInput["filters"]): string {
  const parts: string[] = [];
  if (f.search) parts.push(`search="${f.search}"`);
  if (f.scoreBucket !== "all") parts.push(`scor=${f.scoreBucket}`);
  if (f.userStatus !== "all") parts.push(`status_user=${f.userStatus}`);
  if (f.flagStatus !== "all") parts.push(`status_flag=${f.flagStatus}`);
  if (f.flagKind !== "all") parts.push(`tip_semnal=${f.flagKind}`);
  if (f.fingerprintQuery) {
    parts.push(`fingerprint="${f.fingerprintQuery}" (${f.fingerprintMatches ?? 0} useri)`);
  }
  return parts.length ? parts.join(" · ") : "(fără filtre)";
}

function fmtStatus(u: { banned_at: string | null; suspended_until: string | null }): string {
  if (u.banned_at) return "banat";
  if (u.suspended_until) return "suspendat";
  return "activ";
}

export function exportRiskCsv(input: RiskExportInput): void {
  const lines: Row[] = [];
  lines.push(["Ventuza · Risk dashboard export"]);
  lines.push(["Generat", input.generatedAt]);
  lines.push(["Interval", `${input.windowHours}h`]);
  lines.push(["Filtre", filtersLine(input.filters)]);
  lines.push([]);

  lines.push(["KPI", "Valoare"]);
  for (const [k, v] of Object.entries(input.summary)) lines.push([k, v]);
  lines.push([]);

  lines.push(["Distribuție scor"]);
  lines.push(["bucket", "count"]);
  for (const b of input.distribution) lines.push([b.bucket, b.count]);
  lines.push([]);

  lines.push(["Tipuri de semnale"]);
  lines.push(["kind", "count", "avg_severity"]);
  for (const k of input.kinds) lines.push([k.kind, k.count, k.avg_severity]);
  lines.push([]);

  lines.push([`Top utilizatori (filtrate: ${input.topUsers.length})`]);
  lines.push([
    "user_id",
    "display_name",
    "risk_score",
    "report_count",
    "verified",
    "status",
    "created_at",
  ]);
  for (const u of input.topUsers) {
    lines.push([
      u.user_id,
      u.display_name ?? "",
      u.risk_score,
      u.report_count,
      u.verified ? "yes" : "no",
      fmtStatus(u),
      u.created_at,
    ]);
  }
  lines.push([]);

  lines.push([`Semnale recente (filtrate: ${input.recentFlags.length})`]);
  lines.push(["created_at", "kind", "severity", "status", "user_id", "display_name"]);
  for (const f of input.recentFlags) {
    lines.push([f.created_at, f.kind, f.severity, f.status, f.user_id, f.display_name ?? ""]);
  }

  const csv = rowsToCsv(lines);
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `ventuza-risk-${ts()}.csv`);
}

export function exportRiskPdf(input: RiskExportInput): void {
  const summaryRows = Object.entries(input.summary)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${esc(v)}</td></tr>`)
    .join("");

  const distRows = input.distribution
    .map((b) => `<tr><td>${esc(b.bucket)}</td><td class="r">${b.count}</td></tr>`)
    .join("");

  const kindsRows = input.kinds
    .map(
      (k) =>
        `<tr><td>${esc(k.kind)}</td><td class="r">${k.count}</td><td class="r">${k.avg_severity}</td></tr>`,
    )
    .join("");

  const usersRows = input.topUsers
    .map(
      (u) => `<tr>
      <td class="mono">${esc(u.user_id.slice(0, 12))}…</td>
      <td>${esc(u.display_name ?? "—")}${u.verified ? " ✓" : ""}</td>
      <td class="r"><b>${u.risk_score}</b></td>
      <td class="r">${u.report_count}</td>
      <td>${esc(fmtStatus(u))}</td>
      <td>${esc(u.created_at)}</td>
    </tr>`,
    )
    .join("");

  const flagsRows = input.recentFlags
    .map(
      (f) => `<tr>
      <td>${esc(f.created_at)}</td>
      <td>${esc(f.kind)}</td>
      <td class="r">${f.severity}</td>
      <td>${esc(f.status)}</td>
      <td>${esc(f.display_name ?? "—")}</td>
      <td class="mono">${esc(f.user_id.slice(0, 12))}…</td>
    </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"/>
<title>Ventuza · Risk dashboard ${esc(input.generatedAt)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font: 11px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #ccc; }
  .meta { color: #555; margin-bottom: 10px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th, td { padding: 4px 6px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  td.r, th.r { text-align: right; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  tr { page-break-inside: avoid; }
  .actions { position: fixed; top: 8px; right: 8px; }
  .actions button { font-size: 11px; padding: 4px 10px; cursor: pointer; }
  @media print { .actions { display: none; } }
</style></head><body>
<div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
<h1>Ventuza · Risk scoring dashboard</h1>
<div class="meta">
  Generat: <b>${esc(input.generatedAt)}</b> · Interval: <b>${input.windowHours}h</b><br/>
  Filtre: ${esc(filtersLine(input.filters))}
</div>

<div class="grid2">
  <div>
    <h2>KPI</h2>
    <table><tbody>${summaryRows}</tbody></table>
  </div>
  <div>
    <h2>Distribuție scor</h2>
    <table><thead><tr><th>Bucket</th><th class="r">Useri</th></tr></thead><tbody>${distRows}</tbody></table>
    <h2>Tipuri de semnale</h2>
    <table><thead><tr><th>Tip</th><th class="r">Count</th><th class="r">Sev. medie</th></tr></thead><tbody>${kindsRows || `<tr><td colspan="3">—</td></tr>`}</tbody></table>
  </div>
</div>

<h2>Top utilizatori după scor (${input.topUsers.length})</h2>
<table>
  <thead><tr><th>UUID</th><th>Nume</th><th class="r">Scor</th><th class="r">Rap.</th><th>Status</th><th>Creat</th></tr></thead>
  <tbody>${usersRows || `<tr><td colspan="6">Niciun utilizator.</td></tr>`}</tbody>
</table>

<h2>Semnale recente (${input.recentFlags.length})</h2>
<table>
  <thead><tr><th>Când</th><th>Tip</th><th class="r">Sev.</th><th>Status</th><th>Utilizator</th><th>UUID</th></tr></thead>
  <tbody>${flagsRows || `<tr><td colspan="6">Niciun semnal.</td></tr>`}</tbody>
</table>

<script>setTimeout(() => window.print(), 300);</script>
</body></html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!w) {
    // Popup blocked → fallback: download as .html
    download(new Blob([html], { type: "text/html;charset=utf-8" }), `ventuza-risk-${ts()}.html`);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
