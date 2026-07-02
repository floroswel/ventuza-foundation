import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/blocked-region")({
  head: () => ({
    meta: [
      { title: "Service unavailable in your region — Ventuza" },
      {
        name: "description",
        content:
          "Ventuza is not currently available in your region. Your safety matters — please explore local LGBTQ+ resources listed here.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BlockedRegionPage,
});

function BlockedRegionPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <ShieldAlert className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h1 className="font-serif text-3xl">Ventuza is not available in your region</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          We are unable to safely operate our service where you are right now. This decision is
          about protecting the people who would use our app — not about you personally.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If you are in immediate danger, please prioritise your safety and consider reaching out
          to an international LGBTQ+ support organisation.
        </p>
        <div className="rounded-lg border border-border/60 bg-card/40 p-4 text-left text-sm">
          <p className="font-medium">International support</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>
              <a
                href="https://www.ilga.org"
                className="underline underline-offset-2"
                rel="noreferrer noopener"
                target="_blank"
              >
                ILGA World — country resources
              </a>
            </li>
            <li>
              <a
                href="https://www.rainbowrailroad.org"
                className="underline underline-offset-2"
                rel="noreferrer noopener"
                target="_blank"
              >
                Rainbow Railroad — help to reach safety
              </a>
            </li>
            <li>
              <a
                href="https://outrightinternational.org"
                className="underline underline-offset-2"
                rel="noreferrer noopener"
                target="_blank"
              >
                Outright International
              </a>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          If you believe you reached this page in error, you can{" "}
          <Link to="/legal/privacy" className="underline underline-offset-2">
            read our privacy policy
          </Link>{" "}
          or{" "}
          <Link to="/account-deletion" className="underline underline-offset-2">
            request account deletion
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
