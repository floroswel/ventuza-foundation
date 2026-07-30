/**
 * /admin/guardian — SUZETA AUTONOMOUS APP GUARDIAN.
 *
 * Gate real: toate datele vin din RPC-uri `guardian_*` care verifică
 * `is_staff` / `is_admin_or_above` server-side. UI-ul doar afișează.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { GuardianPanel } from "@/components/admin/GuardianPanel";
import { GuardianBoundary } from "@/components/GuardianBoundary";

export const Route = createFileRoute("/admin/guardian")({
  head: () => ({
    meta: [
      { title: "Guardian — Suzeta Admin" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Monitorizare, incidente și remedieri automate Suzeta." },
    ],
  }),
  component: GuardianRoute,
});

function GuardianRoute() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <Link
        to="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Înapoi la admin
      </Link>
      <GuardianBoundary area="admin_guardian">
        <GuardianPanel />
      </GuardianBoundary>
    </main>
  );
}
