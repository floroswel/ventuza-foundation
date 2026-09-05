import { Link } from "@tanstack/react-router";
import { SUZETA_ICON_URL } from "@/lib/brand-assets";

const ANCHORS: { href: string; label: string }[] = [
  { href: "#screens", label: "Inside the app" },
  { href: "#features", label: "Features" },
  { href: "#safety-and-privacy", label: "Safety" },
  { href: "#community-resources", label: "Resources" },
  { href: "#faq", label: "FAQ" },
];

/** Sticky public header for the marketing page (web only). */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={SUZETA_ICON_URL}
            alt="Suzeta logo"
            width={28}
            height={28}
            className="size-7 rounded-lg border border-border"
          />
          <span className="text-sm font-bold tracking-tight">Suzeta</span>
        </Link>

        <nav aria-label="Sections" className="ml-2 hidden flex-1 md:block">
          <ul className="flex items-center gap-4">
            {ANCHORS.map((a) => (
              <li key={a.href}>
                <a
                  href={a.href}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {a.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="hidden h-9 items-center rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create account
          </Link>
        </div>
      </div>
    </header>
  );
}
