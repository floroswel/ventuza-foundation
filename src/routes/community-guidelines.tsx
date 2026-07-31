import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicFooter } from "@/components/PublicFooter";
import { SITE_URL, SUPPORT_EMAIL, breadcrumbSchema, publicPageMeta } from "@/lib/seo-content";

const TITLE = "Community Guidelines – Suzeta LGBTQ+ Dating App";
const DESCRIPTION =
  "Suzeta community guidelines: adults only, respect, no harassment, no hate speech, no outing without consent, no non-consensual images, and how moderation and reporting work.";

const RULES: { title: string; body: string }[] = [
  {
    title: "Adults only, 18+",
    body: "Suzeta is strictly for adults aged 18 and over. Accounts must pass age verification. Any suspicion of a minor is removed immediately and child sexual abuse material is reported to the authorities.",
  },
  {
    title: "Respect and no harassment",
    body: "No insults, threats, stalking, spam or repeated unwanted contact. If someone asks you to stop, stop. Blocking is available at any time.",
  },
  {
    title: "No hate speech or discrimination",
    body: "No racism, homophobia, transphobia, biphobia, serophobia, misogyny, ableism, or discrimination based on body, ethnicity, religion or HIV status.",
  },
  {
    title: "No outing without consent",
    body: "Never reveal another person's sexual orientation, gender identity or HIV status without their explicit consent, on or off the app.",
  },
  {
    title: "Consent with images",
    body: "No non-consensual sharing of intimate images, no screenshots of private conversations shared publicly, no sexual content sent to someone who did not ask for it.",
  },
  {
    title: "Real, own photos",
    body: "Use photos of yourself. No impersonation, no stolen photos, no fake profiles.",
  },
  {
    title: "No illegal activity or commercial exploitation",
    body: "No drugs, weapons, sex work solicitation, trafficking, scams or financial fraud. Commercial promotion requires prior approval.",
  },
];

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({
    ...publicPageMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: "/community-guidelines",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbSchema("/community-guidelines", "Community guidelines")),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          url: `${SITE_URL}/community-guidelines`,
          description: DESCRIPTION,
        }),
      },
    ],
  }),
  component: GuidelinesPage,
});

function GuidelinesPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Suzeta community guidelines</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          These rules apply to every profile, photo, message and event on Suzeta. Breaking them
          leads to content removal, suspension or a permanent ban.
        </p>

        <div className="mt-8 space-y-4">
          {RULES.map((rule) => (
            <section key={rule.title} className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-base font-semibold text-foreground">{rule.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rule.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Reporting and moderation</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Report a profile, photo or message directly in the app. Reports are reviewed by the
            moderation team, and you can block any member instantly — blocking works in both
            directions and is enforced server-side. You can also write to{" "}
            <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <p className="mt-8 text-sm text-muted-foreground">
          See also the detailed{" "}
          <Link to="/legal/community" className="text-primary hover:underline">
            community rules and support resources
          </Link>
          , the{" "}
          <Link to="/safety" className="text-primary hover:underline">
            safety centre
          </Link>{" "}
          and the{" "}
          <Link to="/legal/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
