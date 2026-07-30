import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Heart,
  MapPin,
  MessageCircle,
  ShieldBan,
  EyeOff,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { oauthOrigin } from "@/lib/canonical-origin";
import suzetaIcon from "@/assets/suzeta-icon.png.asset.json";

const APP_DESCRIPTION =
  "Suzeta is a dating and social connection application for gay, bisexual, queer and other LGBTQ+ adults. Users can create profiles, discover nearby people, match, chat privately and build meaningful connections in a moderated community.";

const SUPPORT_EMAIL = "support@suzeta.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Suzeta — Gay Dating & LGBTQ+ Community" },
      { name: "description", content: APP_DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Suzeta — Gay Dating & LGBTQ+ Community" },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://suzeta.app/" },
      { property: "og:site_name", content: "Suzeta" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Suzeta — Gay Dating & LGBTQ+ Community" },
      { name: "twitter:description", content: APP_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Suzeta",
          url: "https://suzeta.app",
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "Web, Android",
          description: APP_DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        }),
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Heart, label: "Create a personal dating profile" },
  { icon: MapPin, label: "Discover LGBTQ+ people" },
  { icon: MessageCircle, label: "Match and chat privately" },
  { icon: ShieldBan, label: "Block and report users" },
  { icon: EyeOff, label: "Control profile visibility and privacy" },
  { icon: Trash2, label: "Delete your account and personal data" },
];

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [googleBusy, setGoogleBusy] = useState(false);

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
            src={suzetaIcon.url}
            alt="Suzeta logo"
            width={88}
            height={88}
            className="mb-5 size-22 rounded-3xl shadow-xl shadow-primary/20"
          />
          <h1 className="wordmark text-5xl font-medium leading-none sm:text-6xl">Suzeta</h1>
          <p className="mt-3 text-lg font-medium text-primary">
            Gay Dating &amp; LGBTQ+ Community
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {APP_DESCRIPTION}
          </p>

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary text-sm font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90"
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
            <button
              type="button"
              onClick={() => void handleGoogle()}
              disabled={googleBusy}
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-60"
            >
              Continue with Google
            </button>
          </div>
        </section>

        {/* Features */}
        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">What you can do on Suzeta</h2>
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

        {/* Safety */}
        <section className="mt-14">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="size-5 text-primary" /> Safety and privacy
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Suzeta is a moderated community. Any member can block another account at any time and
              report profiles, photos or messages that break our community rules. Reports are
              reviewed by our moderation team and abusive accounts are removed.
            </p>
            <p>
              You stay in control of your privacy: you decide what appears on your profile, you can
              hide your distance and your age, and you can make your profile invisible in discovery
              at any moment. Suzeta never shows your exact location to other users — only an
              approximate distance range.
            </p>
            <p>
              You can request deletion of your account and all associated personal data directly
              from the app, in Settings, or by writing to{" "}
              <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              . Deletion removes your profile, photos, messages and personal data.
            </p>
            <p>
              <Link to="/safety" className="text-primary hover:underline">
                Read our full safety guide
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface/40">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 text-sm text-muted-foreground">
          <p className="text-base font-semibold text-foreground">Suzeta</p>
          <p className="mt-1">
            Support:{" "}
            <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </p>
          <ul className="mt-4 space-y-2">
            <li>
              <a className="text-primary hover:underline" href="https://suzeta.app/legal/privacy">
                Privacy Policy
              </a>
            </li>
            <li>
              <a className="text-primary hover:underline" href="https://suzeta.app/legal/terms">
                Terms of Service
              </a>
            </li>
            <li>
              <Link className="text-primary hover:underline" to="/account-deletion">
                Account deletion
              </Link>
              {" — "}
              request deletion of your account and personal data from Settings in the app or by
              emailing {SUPPORT_EMAIL}.
            </li>
          </ul>
          <p className="mt-6">Suzeta is intended only for adults aged 18 and over.</p>
          <p className="mt-2">© {new Date().getFullYear()} Suzeta</p>
        </div>
      </footer>
    </div>
  );
}
