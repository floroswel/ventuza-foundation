import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { ChevronLeft, Crown, Loader2, Sparkles, Eye, Zap, Heart, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePremium } from "@/lib/use-premium";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/premium")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ventuza Premium" },
      { name: "description", content: "Deblochează vizitatori, like-uri primite, boost-uri și mai mult." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PremiumPage,
});

const FEATURES = [
  { icon: Eye, title: "Vezi cine te-a vizitat", desc: "Lista completă, nu doar ultimul." },
  { icon: Heart, title: "Like-uri primite", desc: "Vezi cine te-a plăcut înainte să faci swipe." },
  { icon: Zap, title: "Boost-uri lunare", desc: "5 boost-uri incluse / lună." },
  { icon: MessageSquare, title: "Mesaje fără limită", desc: "Inițiezi conversații fără match." },
  { icon: Sparkles, title: "Travel mode nelimitat", desc: "Schimbă orașul oricând." },
];

const PRODUCTS = {
  monthly: { id: "ventuza_premium_monthly", price: "49 RON", label: "Lunar" },
  yearly: { id: "ventuza_premium_yearly", price: "399 RON", suffix: "/an", label: "Anual", badge: "−32%" },
};

function PremiumPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isPremium, expiresAt, loading, platform, purchase, restore } = usePremium();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  async function handleBuy(productId: string) {
    try {
      await purchase(productId);
      toast.success("Premium activat ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cumpărarea a eșuat");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/profile" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Crown className="size-4 text-primary" /> Ventuza Premium
        </h1>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        {isPremium ? (
          <section className="rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center glow-gold">
            <Crown className="mx-auto size-8 text-primary" />
            <p className="mt-2 text-sm font-semibold">Ești Premium ✨</p>
            {expiresAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Activ până la {new Date(expiresAt).toLocaleDateString("ro-RO")}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Gestionează abonamentul din Google Play → contul tău → Abonamente.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-surface to-surface p-5">
            <Crown className="size-7 text-primary" />
            <h2 className="mt-2 text-lg font-semibold">Deblochează tot ce contează</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Premium accelerează match-urile bune și îți dă control complet asupra profilului.
            </p>
          </section>
        )}

        {/* Features */}
        <ul className="space-y-2">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3">
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

        {!isPremium && (
          <section className="space-y-3">
            {platform === "android" ? (
              <>
                <button
                  onClick={() => handleBuy(PRODUCTS.yearly.id)}
                  className="flex w-full items-center justify-between rounded-2xl border-2 border-primary bg-primary/10 p-4 glow-gold"
                >
                  <div className="text-left">
                    <p className="text-xs uppercase tracking-wider text-primary">{PRODUCTS.yearly.badge}</p>
                    <p className="mt-0.5 text-sm font-semibold">{PRODUCTS.yearly.label}</p>
                  </div>
                  <p className="text-base font-bold">{PRODUCTS.yearly.price}<span className="text-xs text-muted-foreground">{PRODUCTS.yearly.suffix}</span></p>
                </button>
                <button
                  onClick={() => handleBuy(PRODUCTS.monthly.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4"
                >
                  <p className="text-sm font-semibold">{PRODUCTS.monthly.label}</p>
                  <p className="text-base font-bold">{PRODUCTS.monthly.price}<span className="text-xs text-muted-foreground">/lună</span></p>
                </button>
                <button
                  onClick={() => restore().then(() => toast.success("Restaurat."))}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Restaurează cumpărături
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-center">
                <p className="text-sm font-medium">Premium e disponibil în aplicația Android</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Descarcă Ventuza din Google Play pentru a activa Premium. Plățile pentru servicii digitale
                  destinate Android trebuie să treacă prin Google Play.
                </p>
              </div>
            )}

            <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
              Abonamentele se reînnoiesc automat. Le poți anula oricând din Google Play, cel târziu cu 24h
              înainte de sfârșitul perioadei. Vezi{" "}
              <Link to="/legal/terms" className="underline">Termeni</Link> și{" "}
              <Link to="/legal/privacy" className="underline">Politica de confidențialitate</Link>.
            </p>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
