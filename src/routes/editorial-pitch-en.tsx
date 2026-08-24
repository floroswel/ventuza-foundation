import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/editorial-pitch-en")({
  head: () => ({
    meta: [
      { title: "Suzeta — Editorial Nomination for Google Play" },
      {
        name: "description",
        content:
          "Editorial nomination dossier for Suzeta, a safety-first LGBTQ+ dating app built in Romania.",
      },
      { property: "og:url", content: "https://suzeta.app/editorial-pitch-en" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/editorial-pitch-en" }],
  }),
  component: EditorialPitchEn,
});

function EditorialPitchEn() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Suzeta
        </Link>

        <article className="prose prose-invert mx-auto mt-6 max-w-none text-sm leading-relaxed">
          <h1 className="text-2xl font-bold tracking-tight">
            Suzeta — Editorial Nomination for Google Play
          </h1>
          <p className="text-xs text-muted-foreground">
            Contact: contact@suzeta.ro · DPO: dpo@suzeta.ro
            <br />
            Package: <code>app.suzeta</code> · Website: https://www.suzeta.app
            <br />
            Category: Dating · Content rating: 18+ · Country of origin: Romania
          </p>

          <h2 className="mt-8 text-lg font-semibold">1. In one paragraph</h2>
          <p className="text-foreground/85">
            Suzeta is a dating, friendship and events app for the LGBTQ+ community in Romania, built
            in Romania, in Romanian and English. It exists because the apps this community actually
            uses were designed somewhere else, for someone else, and they charge for the features
            that keep people safe. Suzeta gives all of them away for free: unlimited messages, seeing
            who liked you, profile boost, travel mode, verification, AI assistance. The app pays for
            itself through partnerships with LGBTQ-friendly venues and brands, not through
            subscriptions, not through an ad network, and never through selling data.
          </p>

          <h2 className="mt-8 text-lg font-semibold">2. Why this is worth a reader's attention</h2>
          <p className="text-foreground/85">
            Romania is one of the harder places in the European Union to be openly queer. Being
            outed can cost someone a job, a family, a place to live. That single fact shaped every
            product decision in this app, and it is the part that makes Suzeta different from a
            generic dating clone:
          </p>
          <ul className="list-disc pl-5 text-foreground/85">
            <li>
              <strong>Your exact location never leaves your phone.</strong> Distances shown to other
              users are bucketed ("under 1 km", "1 to 5 km"). The proximity notifications for venues
              and events are calculated on the device itself. There is no location history stored
              anywhere.
            </li>
            <li>
              <strong>Anti-outing is a feature set, not a checkbox.</strong> Incognito mode, private
              album with one-to-one unlock, discreet app behaviour, screenshot protection, and
              granular control over who can see what.
            </li>
            <li>
              <strong>Safety tools you can reach in one tap.</strong> Panic button with a 112 call
              and location shared to trusted contacts, fake incoming call to leave a bad situation,
              quick exit, PIN and biometric lock, and a country risk warning when someone travels
              somewhere less safe.
            </li>
            <li>
              <strong>Special-category data is treated as such.</strong> Optional health information
              is encrypted at column level and can only be written after explicit, recorded consent.
              Withdrawing that consent deletes the data in the same transaction.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold">3. What is genuinely new here</h2>
          <ol className="list-decimal pl-5 text-foreground/85">
            <li>
              <strong>A no-paywall dating app that still has a business model.</strong> Every feature
              normally sold as Premium is free for every user. Revenue comes from a B2B partner
              portal where bars, clubs, clinics and event organisers pay to be listed and promoted.
              Partners are invoiced by bank transfer and confirmed manually, so there is no payment
              processor holding user data.
            </li>
            <li>
              <strong>Human moderation before publication, not after complaints.</strong> No venue,
              event or offer becomes visible to users until a moderator approves it. Approval is a
              single audited server-side action; a partner cannot publish their own content, by
              design and enforced in the database.
            </li>
            <li>
              <strong>Verification without collecting an ID.</strong> Age is checked through a live
              selfie sent to an EU processor that estimates age and deletes the image immediately.
              We never ask for, receive or store an identity document.
            </li>
            <li>
              <strong>A community layer, not just a grid.</strong> A map of manually verified friendly
              venues, an events calendar built around Pride, parties, workshops and meetups, and an
              ambassador programme that rewards people for bringing their friends in.
            </li>
          </ol>

          <h2 className="mt-8 text-lg font-semibold">4. Safety and policy alignment</h2>
          <ul className="list-disc pl-5 text-foreground/85">
            <li>
              <strong>18+ only, enforced.</strong> Age verification is mandatory in production and
              cannot be switched off by configuration. Social features are gated at database level,
              not just hidden in the interface.
            </li>
            <li>
              <strong>Child safety.</strong> Zero tolerance for CSAM. Suspected material is never
              rendered anywhere in the product, including for staff; it is handled by hash and
              escalated to the authorities. Public policy pages:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/child-safety">
                /child-safety
              </a>{" "}
              and{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/age-policy">
                /legal/age-policy
              </a>
            </li>
            <li>
              <strong>DSA compliance.</strong> Single point of contact, reporting flow under Article
              16, and transparent appeals under Article 20:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/dsa">
                /legal/dsa
              </a>
            </li>
            <li>
              <strong>GDPR.</strong> Appointed DPO, published subprocessor list, an internal Article
              30 register, data export under Article 20, and full account deletion.{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/privacy">
                /legal/privacy
              </a>{" "}
              ·{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/subprocessors">
                /legal/subprocessors
              </a>
            </li>
            <li>
              <strong>No advertising ID.</strong> The <code>AD_ID</code> permission is explicitly
              removed from the merged manifest. No AdMob, no cross-app tracking, no data brokers.
            </li>
            <li>
              <strong>No background location permission.</strong> Proximity works without it.
            </li>
            <li>
              <strong>Anti-abuse.</strong> Bot protection on every auth form, device
              fingerprinting, rate limits enforced in the database, and bilateral blocking that is
              applied by a database trigger rather than by the client.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold">5. Technical quality signals</h2>
          <ul className="list-disc pl-5 text-foreground/85">
            <li>
              Native Android build with edge-to-edge support for Android 15 and later, targeting the
              current API level required by Play.
            </li>
            <li>
              <code>FLAG_SECURE</code> against screenshots and screen recording on sensitive screens,
              hardened WebView settings, certificate pinning in the network security config, and
              root and integrity checks.
            </li>
            <li>
              Offline support, persistent caching, image compression on upload, lazy loading and
              code splitting, with first-screen skeletons instead of spinners.
            </li>
            <li>Full Romanian and English localisation.</li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold">6. What we are asking for</h2>
          <p className="text-foreground/85">
            Consideration for editorial placement in the Dating and Social categories, and for any
            Google Play collection that highlights safety-first products, locally built apps, or
            apps serving underrepresented communities in Central and Eastern Europe.
          </p>
          <p className="text-foreground/85">
            We are happy to provide a pre-verified reviewer account, a demo walkthrough, our DPIA,
            and our incident response plan on request.
          </p>

          <h2 className="mt-8 text-lg font-semibold">7. Press kit</h2>
          <ul className="list-disc pl-5 text-foreground/85">
            <li>
              Store listing:{" "}
              <a
                className="text-primary underline"
                href="https://play.google.com/store/apps/details?id=app.suzeta"
              >
                play.google.com/store/apps/details?id=app.suzeta
              </a>
            </li>
            <li>
              Website:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app">
                www.suzeta.app
              </a>
            </li>
            <li>Feature graphic and icon: store-assets/</li>
            <li>Screenshots: store-assets/README.md</li>
            <li>
              Terms:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/terms">
                /legal/terms
              </a>
            </li>
            <li>
              Community guidelines:{" "}
              <a
                className="text-primary underline"
                href="https://www.suzeta.app/community-guidelines"
              >
                /community-guidelines
              </a>
            </li>
            <li>
              Safety centre:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/safety">
                /safety
              </a>
            </li>
          </ul>

          <hr className="my-8 border-border" />
          <p className="text-xs text-muted-foreground">
            Also available in{" "}
            <Link to="/editorial-pitch-ro" className="text-primary underline">
              Romanian
            </Link>
            .
          </p>
        </article>
      </main>
    </div>
  );
}
