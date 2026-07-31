import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicFooter } from "@/components/PublicFooter";
import {
  INTRO_PARAGRAPH,
  SITE_URL,
  SUPPORT_EMAIL,
  PRIVACY_EMAIL,
  breadcrumbSchema,
  publicPageMeta,
} from "@/lib/seo-content";

const TITLE = "About Suzeta – LGBTQ+ Dating & Chat App";
const DESCRIPTION =
  "About Suzeta: a dating and social connection app for gay, bisexual, queer and other LGBTQ+ adults, available on the web and on Android, built in Romania for the EU.";

export const Route = createFileRoute("/about")({
  head: () => ({
    ...publicPageMeta({ title: TITLE, description: DESCRIPTION, path: "/about" }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbSchema("/about", "About Suzeta")),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: TITLE,
          url: `${SITE_URL}/about`,
          description: DESCRIPTION,
          about: { "@id": `${SITE_URL}/#organization` },
        }),
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">About Suzeta</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{INTRO_PARAGRAPH}</p>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">What Suzeta is</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Suzeta is a gay dating and LGBTQ+ chat application available on the web at suzeta.app
            and as a native Android app. Members create a profile, discover people, match and chat
            privately inside a moderated community for adults aged 18 and over.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Purpose</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Suzeta exists to give LGBTQ+ adults a space where meeting people feels safe and where
            privacy is the default: no exact location shared with other members, clear rules against
            hate and harassment, and full control over what a profile reveals.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Who Suzeta is for</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Gay, bisexual, queer and other LGBTQ+ adults aged 18 and over. Age verification is
            mandatory before an account can be used. Suzeta is used for dating, chat, friendship and
            community connections.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Main features</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Personal profile with photos, pronouns, identity and what you are looking for</li>
            <li>Discover people nearby, shown as an approximate distance range</li>
            <li>Matching based on mutual interest</li>
            <li>Private chat with text, photos and voice messages</li>
            <li>Blocking and reporting, enforced server-side</li>
            <li>Privacy controls: hide age, hide distance, hide profile from Discover</li>
            <li>Account and data deletion at any time</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Community standards</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            No minors, no harassment, no hate speech, no racism, no homophobia or transphobia, no
            outing without consent, no non-consensual images, no illegal content.{" "}
            <Link to="/community-guidelines" className="text-primary hover:underline">
              Read the community guidelines
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Safety approach</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Mandatory age verification, moderation of reported content, mutual blocking enforced at
            database level, approximate distance instead of exact coordinates, and encryption of
            sensitive data processed in the EU under GDPR.{" "}
            <Link to="/safety" className="text-primary hover:underline">
              See the safety centre
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Official contact details</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              Brand: <strong className="text-foreground">Suzeta</strong>
            </li>
            <li>
              Website:{" "}
              <a className="text-primary hover:underline" href={`${SITE_URL}/`}>
                {SITE_URL}
              </a>
            </li>
            <li>Category: LGBTQ+ dating and social connection application</li>
            <li>Audience: adults aged 18+</li>
            <li>Platforms: Web and Android</li>
            <li>
              Support:{" "}
              <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              Privacy / data protection:{" "}
              <a className="text-primary hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
                {PRIVACY_EMAIL}
              </a>
            </li>
          </ul>
        </section>

        <p className="mt-10 text-sm">
          <Link to="/faq" className="text-primary hover:underline">
            Frequently asked questions
          </Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
