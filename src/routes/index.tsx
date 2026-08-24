import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Heart,
  MapPin,
  MessageCircle,
  ShieldBan,
  EyeOff,
  Trash2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { PLAY_STORE_URL } from "@/lib/store-links";
import { GetAppBanner } from "@/components/GetAppBanner";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { oauthOrigin } from "@/lib/canonical-origin";
import { PublicFooter } from "@/components/PublicFooter";
import { SUZETA_ICON_URL } from "@/lib/brand-assets";
import { isNativePlatformSync } from "@/lib/native-platform-sync";
import {
  FAQ,
  HOME_DESCRIPTION,
  HOME_TITLE,
  INTRO_PARAGRAPH,
  LOGO_512,
  OG_IMAGE,
  SITE_URL,
  SUPPORT_EMAIL,
  faqPageSchema,
} from "@/lib/seo-content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:site_name", content: "Suzeta" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: HOME_TITLE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "Suzeta",
              url: `${SITE_URL}/`,
              logo: LOGO_512,
              image: OG_IMAGE,
              description: INTRO_PARAGRAPH,
              email: SUPPORT_EMAIL,
              areaServed: ["RO", "EU"],
              knowsLanguage: ["ro", "en"],
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  contactType: "customer support",
                  email: SUPPORT_EMAIL,
                  availableLanguage: ["Romanian", "English"],
                },
              ],
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: `${SITE_URL}/`,
              name: "Suzeta",
              alternateName: ["Suzeta App", "Suzeta Dating"],
              inLanguage: ["ro", "en"],
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
            {
              "@type": "SoftwareApplication",
              "@id": `${SITE_URL}/#app`,
              name: "Suzeta",
              url: `${SITE_URL}/`,
              applicationCategory: "SocialNetworkingApplication",
              operatingSystem: "Web, Android",
              description: INTRO_PARAGRAPH,
              image: LOGO_512,
              contentRating: "Mature 17+",
              inLanguage: ["ro", "en"],
              publisher: { "@id": `${SITE_URL}/#organization` },
              audience: { "@type": "Audience", suggestedMinAge: 18 },
            },
            faqPageSchema(`${SITE_URL}/#faq`),
          ],
        }),
      },
    ],
  }),
  // În app-ul nativ (Capacitor) landing-ul de marketing nu are rost: primul
  // ecran trebuie să fie direct autentificarea. Pe web rămâne pagina publică
  // (SEO/crawlere) — `isNativePlatformSync()` e false pe server și în browser.
  beforeLoad: () => {
    if (isNativePlatformSync()) throw redirect({ to: "/auth", replace: true });
  },
  component: Landing,
});

const FEATURES = [
  { icon: Heart, label: "Create a personal dating profile with photos, pronouns and interests" },
  { icon: MapPin, label: "Discover gay, bisexual and queer people around you" },
  { icon: MessageCircle, label: "Match and chat privately with text, photos and voice messages" },
  { icon: ShieldBan, label: "Block and report any account, at any time" },
  { icon: EyeOff, label: "Control profile visibility, hide your age and your distance" },
  { icon: Trash2, label: "Delete your account and personal data whenever you want" },
];

const STEPS = [
  {
    title: "1. Create your account",
    body: "Sign up with email or Google, confirm you are 18 or over and complete age verification.",
  },
  {
    title: "2. Build your profile",
    body: "Add photos, pronouns, what you are looking for and the details you want other members to see.",
  },
  {
    title: "3. Discover people",
    body: "Browse LGBTQ+ people nearby or use filters to find members who match what you are looking for.",
  },
  {
    title: "4. Match and chat",
    body: "Show interest, get a match and start a private conversation. Block or report anyone who makes you uncomfortable.",
  },
];

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [googleBusy, setGoogleBusy] = useState(false);
  // Google e disponibil DOAR pe web. În app-ul nativ (Play Store) fluxul OAuth
  // prin webview nu e suportat, deci butonul nu se randează deloc.
  const [googleAvailable, setGoogleAvailable] = useState(!isNativePlatformSync());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!cancelled) setGoogleAvailable(!Capacitor.isNativePlatform());
      } catch {
        /* web */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Signed-in users are sent into the app; logged-out visitors and crawlers
  // always get the full public landing page rendered server-side.
  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      navigate({ to: data?.onboarding_completed ? "/discover" : "/n", replace: true });
    })();
  }, [user, loading, navigate]);

  async function handleGoogle() {
    setGoogleBusy(true);
    try {
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${oauthOrigin()}/auth`,
      });
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <img
            src={SUZETA_ICON_URL}
            alt="Suzeta logo"
            width={88}
            height={88}
            className="mb-5 size-22 rounded-3xl shadow-xl shadow-primary/20"
          />
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Suzeta – Gay Dating &amp; LGBTQ+ Chat App
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {INTRO_PARAGRAPH}
          </p>

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Smartphone className="size-4" />
              Get it on Google Play
            </a>
            <p className="text-xs text-muted-foreground">
              Free Android app · or continue in your browser below
            </p>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-12 items-center justify-center rounded-full border border-primary/30 bg-surface text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/10"
            >
              Create account
            </Link>

            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="inline-flex h-12 items-center justify-center rounded-full border border-primary/30 bg-surface text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/10"
            >
              Sign in
            </Link>
            {googleAvailable && (
              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={googleBusy}
                className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-60"
              >
                Continue with Google
              </button>
            )}
          </div>
        </section>

        {/* What is Suzeta */}
        <section className="mt-14" id="what-is-suzeta">
          <h2 className="text-2xl font-semibold tracking-tight">What is Suzeta?</h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Suzeta is a gay dating and LGBTQ+ chat app for adults. You create a profile, discover
              people around you, match with the members you like and chat privately. It runs in any
              modern browser at suzeta.app and as a native Android app.
            </p>
            <p>
              Suzeta is built in Romania for the Romanian and wider European LGBTQ+ community, with
              a Romanian and English interface and data processed in the EU under GDPR.{" "}
              <Link to="/about" className="text-primary hover:underline">
                Read more about Suzeta
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Who is it for */}
        <section className="mt-12" id="who-is-suzeta-for">
          <h2 className="text-2xl font-semibold tracking-tight">Who is Suzeta for?</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Suzeta is for gay, bisexual, queer and other LGBTQ+ adults aged 18 and over who want to
            meet new people — for dating, for private chat, for friendship or for community events.
            Accounts must pass age verification before they can be used, and Suzeta is never
            available to minors.
          </p>
        </section>

        {/* How it works */}
        <section className="mt-12" id="how-suzeta-works">
          <h2 className="text-2xl font-semibold tracking-tight">How Suzeta works</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {STEPS.map((s) => (
              <li key={s.title} className="rounded-2xl border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section className="mt-12" id="features">
          <h2 className="text-2xl font-semibold tracking-tight">Key features</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm leading-relaxed">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Dating & chat */}
        <section className="mt-12" id="gay-dating-and-private-chat">
          <h2 className="text-2xl font-semibold tracking-tight">Gay dating and private chat</h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Dating on Suzeta starts in Discover: you browse LGBTQ+ profiles and show interest in
              the people you like. When the interest is mutual, a match opens a private
              conversation.
            </p>
            <p>
              Private chat supports text, photos and voice messages, with delivery and read
              receipts. Conversations stay between the two members, and blocking a member stops
              messaging in both directions immediately.
            </p>
          </div>
        </section>

        {/* Safety */}
        <section className="mt-12" id="safety-and-privacy">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="size-5 text-primary" /> Safety and privacy
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Suzeta is a moderated community. Any member can block another account at any time and
              report profiles, photos or messages that break the community rules. Reports are
              reviewed by the moderation team and abusive accounts are removed.
            </p>
            <p>
              Suzeta never shows your exact location to other users — only an approximate distance
              range. You decide what appears on your profile, you can hide your distance and your
              age, and you can make your profile invisible in Discover at any moment. Sensitive data
              is encrypted and processed in the EU under GDPR.
            </p>
            <p>
              <Link to="/safety" className="text-primary hover:underline">
                Read the full safety guide
              </Link>{" "}
              or the{" "}
              <Link to="/legal/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Community guidelines */}
        <section className="mt-12" id="community-guidelines">
          <h2 className="text-2xl font-semibold tracking-tight">Community guidelines</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Suzeta has clear rules: no minors, no harassment, no hate speech, no racism, no
            homophobia or transphobia, no outing another person without consent, no non-consensual
            sharing of images and no illegal content. Breaking the rules leads to content removal,
            suspension or a permanent ban.{" "}
            <Link to="/community-guidelines" className="text-primary hover:underline">
              Read the community guidelines
            </Link>
            .
          </p>
        </section>

        {/* Account deletion */}
        <section className="mt-12" id="account-deletion">
          <h2 className="text-2xl font-semibold tracking-tight">Account deletion</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            You can delete your Suzeta account at any time from Settings in the app, or from the
            public{" "}
            <Link to="/account-deletion" className="text-primary hover:underline">
              account deletion page
            </Link>
            . Deletion removes your profile, photos, messages and personal data. You can also write
            to{" "}
            <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        {/* FAQ — răspunsuri scurte, citabile de motoarele de căutare și AI */}
        <section className="mt-12" id="faq">
          <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
          <dl className="mt-5 space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border border-border bg-surface p-5">
                <dt className="text-base font-semibold text-foreground">
                  <h3>{item.q}</h3>
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm">
            <Link to="/faq" className="text-primary hover:underline">
              See the full FAQ page
            </Link>
          </p>
        </section>

        {/* Contact */}
        <section className="mt-12" id="contact">
          <h2 className="text-2xl font-semibold tracking-tight">Contact and support</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Support:{" "}
            <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            . More options on the{" "}
            <Link to="/contact" className="text-primary hover:underline">
              contact page
            </Link>
            .
          </p>
        </section>
      </main>

      <PublicFooter />
      <GetAppBanner />

    </div>
  );
}
