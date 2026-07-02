import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ChevronLeft,
  Sparkles,
  Eye,
  Zap,
  Heart,
  MessageSquare,
  Plane,
  BadgeCheck,
  Megaphone,
  Gift,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/premium")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Totul e gratuit — Ventuza" },
      {
        name: "description",
        content:
          "Toate funcțiile Ventuza sunt 100% gratuite pentru utilizatori. Susține-ne prin Ventuza Ads.",
      },
    ],
  }),
  component: PremiumPage,
});

const FREE_FOR_ALL = [
  { icon: Eye, title: "Vezi cine te-a vizitat", desc: "Lista completă a vizitatorilor." },
  { icon: Heart, title: "Like-uri primite", desc: "Vezi cine te-a plăcut înainte de swipe." },
  { icon: Zap, title: "Boost 30 min", desc: "Boost de profil — gratuit, oricând." },
  { icon: MessageSquare, title: "Mesaje fără limită", desc: "Inițiezi conversații cu oricine." },
  { icon: Plane, title: "Travel / Roam", desc: "Schimbă orașul oricând, fără cost." },
  { icon: BadgeCheck, title: "Verificare AI", desc: "Selfie verificat → badge oficial." },
  { icon: Sparkles, title: "AI Wingman, Bio, Match", desc: "Asistent AI pentru chat și profil." },
];

function PremiumPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/profile"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Gift className="size-4 text-primary" /> Totul e gratuit
        </h1>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-surface to-surface p-5 glow-gold">
          <Gift className="size-7 text-primary" />
          <h2 className="mt-2 text-lg font-semibold">Ventuza e 100% gratuit ✨</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nimic plătit, nicio funcție blocată. Toate uneltele pe care alte aplicații le pun după
            paywall — la tine sunt deschise din prima zi.
          </p>
        </section>

        <ul className="space-y-2">
          {FREE_FOR_ALL.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <Megaphone className="size-6 text-primary" />
          <h3 className="mt-2 text-base font-semibold">Cum ne susținem?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Prin <span className="font-semibold text-foreground">Ventuza Ads</span> — parteneriate
            cu cluburi, baruri, evenimente și branduri LGBTQ-friendly din România. Plătesc ei, tu
            folosești app-ul gratuit.
          </p>
          <Link
            to="/advertise"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Megaphone className="size-4" /> Promovează-ți businessul
          </Link>
        </section>

        <p className="text-center text-[10px] text-muted-foreground">
          Vrei să ne susții personal? Spune-le prietenilor despre Ventuza. Asta contează mai mult
          decât orice donație.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
