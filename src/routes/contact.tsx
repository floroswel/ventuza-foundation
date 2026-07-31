import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicFooter } from "@/components/PublicFooter";
import {
  PRIVACY_EMAIL,
  SITE_URL,
  SUPPORT_EMAIL,
  breadcrumbSchema,
  publicPageMeta,
} from "@/lib/seo-content";

const TITLE = "Contact & Support – Suzeta";
const DESCRIPTION =
  "Contact Suzeta: support email for the LGBTQ+ dating and chat app, privacy and data protection requests, reporting abuse, and account deletion.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    ...publicPageMeta({ title: TITLE, description: DESCRIPTION, path: "/contact" }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbSchema("/contact", "Contact")),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: TITLE,
          url: `${SITE_URL}/contact`,
          description: DESCRIPTION,
        }),
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Contact and support</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Write to us and we will reply in Romanian or English.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">General support</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Questions about your account, the app or a technical issue:{" "}
            <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Privacy and data protection</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            GDPR requests (access, rectification, erasure, portability, objection):{" "}
            <a className="text-primary hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
              {PRIVACY_EMAIL}
            </a>
            . See the{" "}
            <Link to="/legal/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Reporting abuse or illegal content</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Inside the app, use the report button on a profile, photo or message. For legal notices
            see the{" "}
            <Link to="/legal/dsa" className="text-primary hover:underline">
              DSA contact point
            </Link>{" "}
            or the{" "}
            <Link to="/legal/dmca" className="text-primary hover:underline">
              copyright procedure
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Account deletion</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Delete your account from Settings in the app or from the public{" "}
            <Link to="/account-deletion" className="text-primary hover:underline">
              account deletion page
            </Link>
            .
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
