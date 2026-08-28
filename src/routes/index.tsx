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
import { trackStoreFunnel } from "@/lib/store-analytics";
import {
  storeUrlForPlatform,
  storeReferrer,
  isAndroidAppInstalled,
  isMobileWebBrowser,
  openAppOrStore,
} from "@/lib/store-links";
import { getInstallCtaVariant, installCtaLabel } from "@/lib/install-ab-test";
import { FunnelDebugOverlay } from "@/components/FunnelDebugOverlay";
import { GetAppBanner } from "@/components/GetAppBanner";
import { ScreenshotGallery, type Shot } from "@/components/landing/ScreenshotGallery";


import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
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
  {
    icon: MapPin,
    title: "Discover nearby",
    body: "Browse gay, bisexual and queer people around you. Approximate distance only, never an exact location.",
  },
  {
    icon: Heart,
    title: "Match on interest",
    body: "Show interest in a profile. When it is mutual, a private conversation opens.",
  },
  {
    icon: MessageCircle,
    title: "Private chat",
    body: "Text, photos and voice messages, with delivery and read receipts.",
  },
  {
    icon: Smartphone,
    title: "Web and Android",
    body: "Runs in any modern browser at suzeta.app and as a native Android app.",
  },
  {
    icon: EyeOff,
    title: "Your profile, your rules",
    body: "Pick what shows up. Hide your age, hide your distance, go invisible in Discover.",
  },
  {
    icon: ShieldCheck,
    title: "Age-verified accounts",
    body: "Every account passes age verification before it can be used. No minors, ever.",
  },
];

const SAFETY = [
  {
    icon: ShieldBan,
    title: "Blocking works both ways",
    body: "Block an account and messaging stops in both directions, immediately.",
  },
  {
    icon: ShieldCheck,
    title: "Report anything",
    body: "Profiles, photos and messages can be reported. Moderators review reports and remove abusive accounts.",
  },
  {
    icon: EyeOff,
    title: "Hide age and distance",
    body: "Both are optional on your profile, and you can turn them off at any time.",
  },
  {
    icon: MapPin,
    title: "Discreet mode",
    body: "Make your profile invisible in Discover without losing your account or your conversations.",
  },
  {
    icon: Trash2,
    title: "Delete everything",
    body: "Delete your account from Settings and your profile, photos, messages and personal data go with it.",
  },
];

const STEPS = [
  {
    title: "Create your account",
    body: "Sign up with your email, confirm you are 18 or over and complete age verification.",
  },
  {
    title: "Build your profile",
    body: "Add photos, pronouns, what you are looking for and the details you want others to see.",
  },
  {
    title: "Discover people",
    body: "Browse LGBTQ+ people nearby or filter for the members who match what you want.",
  },
  {
    title: "Match and chat",
    body: "Show interest, get a match, start a private conversation. Block or report anyone who makes you uncomfortable.",
  },
];

/**
 * Capturi reale din aplicație. Nu există încă în repo, deci rămân
 * placeholdere marcate; adaugă fișierele în `public/screenshots/`.
 */
const SHOTS: Shot[] = [
  { label: "Discover", expectedFile: "/screenshots/discover.jpg" },
  { label: "Chat", expectedFile: "/screenshots/chat.jpg" },
  { label: "Profile", expectedFile: "/screenshots/profile.jpg" },
  { label: "Privacy", expectedFile: "/screenshots/privacy.jpg" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">{children}</h2>
  );
}

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  // Logarea cu Google este DEZACTIVATĂ complet (web + nativ).
  // `null` = necunoscut (API indisponibil). Doar `true` schimbă CTA-ul.
  const [appInstalled, setAppInstalled] = useState<boolean | null>(null);
  // Variantă A/B pe CTA-ul de instalare (stabilă per device).
  const [ctaVariant, setCtaVariant] = useState<"play_badge" | "open_app">("play_badge");
  useEffect(() => setCtaVariant(getInstallCtaVariant()), []);
  useEffect(() => {
    let cancelled = false;
    void isAndroidAppInstalled().then((v) => {
      if (!cancelled) setAppInstalled(v);
    });
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

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        {/* 1 — Hero */}
        <section className="flex flex-col items-center text-center">
          <img
            src={SUZETA_ICON_URL}
            alt="Suzeta logo"
            width={72}
            height={72}
            className="mb-5 size-18 rounded-2xl border border-border"
          />
          <h1 className="text-3xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            Gay dating and chat, done privately
          </h1>
          <p className="mt-4 max-w-[38ch] text-base leading-relaxed text-muted-foreground">
            Meet LGBTQ+ people near you, match and talk — on your terms.
          </p>

          <div className="mt-7 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={storeUrlForPlatform("hero_cta")}
              onClick={(e) => {
                // Pe mobil deschidem aplicația instalată (intent Android /
                // Universal Link iOS); dacă nu e instalată, ajungem în magazin.
                if (isMobileWebBrowser()) {
                  e.preventDefault();
                  openAppOrStore("/", "hero_cta", appInstalled, ctaVariant);
                  return;
                }
                trackStoreFunnel("store_click", {
                  source: "hero_cta",
                  appInstalled,
                  variant: ctaVariant,
                  referrer: storeReferrer("hero_cta"),
                });
              }}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold tracking-tight text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Smartphone className="size-4" />
              {installCtaLabel(ctaVariant, appInstalled)}
            </a>

            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-semibold tracking-tight text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Continue in browser
            </Link>
          </div>

          {/* 2 — Trei dovezi */}
          <p className="mt-5 max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
            Built in Romania <span aria-hidden>·</span> Data stays in the EU{" "}
            <span aria-hidden>·</span> Every account is age-verified
          </p>

          <p className="mt-3 text-xs text-muted-foreground">
            {appInstalled ? (
              "The Android app is already installed on this device"
            ) : (
              <>
                Free Android app ·{" "}
                <Link to="/auth" search={{ mode: "login" }} className="text-primary hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </section>

        {/* 3 — Galerie de ecrane */}
        <section className="mt-14" id="screens">
          <Eyebrow>Inside the app</Eyebrow>
          <SectionTitle>What it looks like</SectionTitle>
          <div className="mt-5">
            <ScreenshotGallery shots={SHOTS} />
          </div>
        </section>

        {/* 4 — Carduri de funcții */}
        <section className="mt-14" id="features">
          <Eyebrow>Features</Eyebrow>
          <SectionTitle>What you can do</SectionTitle>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-xl border border-border bg-card p-4">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="size-4" />
                </span>
                <h3 className="mt-3 text-sm font-semibold tracking-tight">{title}</h3>
                <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* 5 — Siguranță și confidențialitate */}
        <section className="mt-14" id="safety-and-privacy">
          <Eyebrow>Safety</Eyebrow>
          <SectionTitle>Safety and privacy</SectionTitle>
          <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            Suzeta is a moderated community. Your exact location is never shown to other members —
            only an approximate distance range. Sensitive data is encrypted and processed in the EU
            under GDPR.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {SAFETY.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
                </div>
                <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link to="/safety" className="text-primary hover:underline">
              Read the full safety guide
            </Link>{" "}
            or the{" "}
            <Link to="/legal/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        {/* 6 — Cum funcționează */}
        <section className="mt-14" id="how-suzeta-works">
          <Eyebrow>Getting started</Eyebrow>
          <SectionTitle>How Suzeta works</SectionTitle>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-semibold tracking-tight">{s.title}</h3>
                </div>
                <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* SEO — textul lung rămâne, mutat sub dovezi și funcții */}
        <section className="mt-14" id="what-is-suzeta">
          <Eyebrow>About</Eyebrow>
          <SectionTitle>What is Suzeta?</SectionTitle>
          <div className="mt-3 max-w-[65ch] space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>{INTRO_PARAGRAPH}</p>
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

        <section className="mt-12" id="who-is-suzeta-for">
          <SectionTitle>Who is Suzeta for?</SectionTitle>
          <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            Suzeta is for gay, bisexual, queer and other LGBTQ+ adults aged 18 and over who want to
            meet new people — for dating, for private chat, for friendship or for community events.
            Accounts must pass age verification before they can be used, and Suzeta is never
            available to minors.
          </p>
        </section>

        <section className="mt-12" id="gay-dating-and-private-chat">
          <SectionTitle>Gay dating and private chat</SectionTitle>
          <div className="mt-3 max-w-[65ch] space-y-3 text-sm leading-relaxed text-muted-foreground">
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

        <section className="mt-12" id="community-guidelines">
          <SectionTitle>Community guidelines</SectionTitle>
          <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
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

        <section className="mt-12" id="account-deletion">
          <SectionTitle>Account deletion</SectionTitle>
          <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
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

        {/* 7 — FAQ — răspunsuri scurte, citabile de motoarele de căutare și AI */}
        <section className="mt-14" id="faq">
          <Eyebrow>FAQ</Eyebrow>
          <SectionTitle>Frequently asked questions</SectionTitle>
          <dl className="mt-5 space-y-3">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-xl border border-border bg-card p-5">
                <dt className="text-base font-semibold tracking-tight text-foreground">
                  <h3>{item.q}</h3>
                </dt>
                <dd className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm">
            <Link to="/faq" className="text-primary hover:underline">
              See the full FAQ page
            </Link>
          </p>
        </section>

        <section className="mt-12" id="contact">
          <SectionTitle>Contact and support</SectionTitle>
          <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
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
      <FunnelDebugOverlay />
    </div>
  );
}

