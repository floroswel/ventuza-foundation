import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/legal/subprocessors")({
  head: () => ({
    meta: [
      { title: "Subprocesatori — Ventuza" },
      { name: "description", content: "Lista terților care procesează date în numele Ventuza." },
    ],
    links: [{ rel: "canonical", href: "https://ventuza-foundation.lovable.app/legal/subprocessors" }],
  }),
  component: SubsPage,
});

const ROWS = [
  { name: "Supabase (via Lovable Cloud)", purpose: "Bază de date, autentificare, stocare fotografii, realtime", location: "UE (Frankfurt)", transfer: "—" },
  { name: "Cloudflare Workers", purpose: "Edge runtime pentru server functions și SSR", location: "Global edge", transfer: "SCC-uri 2021/914" },
  { name: "Google Cloud (Vision/Moderation)", purpose: "Moderare AI fotografii — detectare nuditate, CSAM, violență", location: "UE", transfer: "SCC-uri 2021/914" },
  { name: "Google Play Billing", purpose: "Procesare abonamente Premium pe Android", location: "Global", transfer: "SCC-uri 2021/914" },
  { name: "Apple App Store IAP", purpose: "Procesare abonamente Premium pe iOS", location: "Global", transfer: "SCC-uri 2021/914" },
  { name: "Resend / SES", purpose: "Email tranzacțional (confirmare cont, resetare parolă)", location: "UE/SUA", transfer: "SCC-uri 2021/914" },
  { name: "OneSignal / FCM", purpose: "Notificări push", location: "SUA", transfer: "SCC-uri 2021/914" },
];

function SubsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Subprocesatori</h1>
      </header>
      <article className="mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Ultima actualizare: 22 iunie 2026</p>
        <p className="mt-4">Toți subprocesatorii au DPA semnat cu Ventuza, conform GDPR Art. 28. Pentru transferuri în afara SEE folosim Clauzele Contractuale Standard ale Comisiei Europene (Decizia 2021/914).</p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">Furnizor</th>
                <th className="px-3 py-2 text-left">Scop</th>
                <th className="px-3 py-2 text-left">Locație</th>
                <th className="px-3 py-2 text-left">Mecanism transfer</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.name} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.purpose}</td>
                  <td className="px-3 py-2">{r.location}</td>
                  <td className="px-3 py-2">{r.transfer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">Modificările listei sunt anunțate cu minim 30 de zile înainte. Poți obiecta la <a className="text-primary" href="mailto:dpo@ventuza.app">dpo@ventuza.app</a>.</p>
      </article>
    </div>
  );
}
