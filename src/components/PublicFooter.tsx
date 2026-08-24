import { Link } from "@tanstack/react-router";
import { SUPPORT_EMAIL } from "@/lib/seo-content";
import { PLAY_STORE_URL } from "@/lib/app-store-link";

const LINKS: { to: string; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About Suzeta" },
  { to: "/faq", label: "FAQ" },
  { to: "/safety", label: "Safety" },
  { to: "/community-guidelines", label: "Community guidelines" },
  { to: "/child-safety", label: "Child safety standards" },
  { to: "/contact", label: "Contact & support" },
  { to: "/legal/privacy", label: "Privacy Policy" },
  { to: "/legal/terms", label: "Terms of Service" },
  { to: "/account-deletion", label: "Account deletion" },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto w-full max-w-3xl px-6 py-10 text-sm text-muted-foreground">
        <p className="text-base font-semibold text-foreground">Suzeta</p>
        <p className="mt-1">
          Support:{" "}
          <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
        {/* Link permanent către aplicație. Bannerul de sus apare doar pe
            Android și se poate închide; aici rămâne găsibil de oriunde,
            inclusiv de pe desktop, de unde oamenii caută des aplicația. */}
        <p className="mt-3">
          <a
            className="inline-flex items-center gap-2 text-primary hover:underline"
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-play-link"
          >
            Descarcă aplicația Android din Google Play
          </a>
        </p>
        <nav aria-label="Footer" className="mt-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link className="text-primary hover:underline" to={l.to}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-6">Suzeta is intended only for adults aged 18 and over.</p>
        <p className="mt-2">© {new Date().getFullYear()} Suzeta</p>
      </div>
    </footer>
  );
}
