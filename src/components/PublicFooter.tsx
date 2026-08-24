import { Link } from "@tanstack/react-router";
import { SUPPORT_EMAIL } from "@/lib/seo-content";
import { playStoreUrl } from "@/lib/store-links";
import { trackStoreFunnel } from "@/lib/store-analytics";


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
        <p className="mt-3">
          <a
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
            href={playStoreUrl("footer")}
            onClick={() => trackStoreFunnel("store_click", { source: "footer" })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get it on Google Play
          </a>
        </p>
        <p className="mt-3">
          Support:{" "}
          <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
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
