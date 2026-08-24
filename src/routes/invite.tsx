import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Share2, Copy, Check, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getMyReferralCode, referralLink } from "@/lib/referrals";
import { formatUsd } from "@/lib/wallet";

export const Route = createFileRoute("/invite")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Invită 3 prieteni — Suzeta" },
      {
        name: "description",
        content:
          "Invită 3 prieteni în Suzeta și primești $6 în portofel, de folosit pentru produse cu logo Suzeta.",
      },
      { property: "og:title", content: "Invită 3 prieteni — Suzeta" },
      {
        property: "og:description",
        content: "Fii ambasador Suzeta: invită prieteni și adună credite pentru merch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/invite" }],
  }),
  component: InvitePage,
});

function InvitePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMyReferralCode().then(setCode);
    try {
      localStorage.setItem("suzeta:invite-screen-seen", "1");
    } catch {
      /* ignore */
    }
  }, []);

  const link = code ? referralLink(code) : "";

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Link copiat");
  }

  async function share() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Suzeta",
          text: "Hai pe Suzeta — primim amândoi credite în portofel",
          url: link,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await copy();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center text-center">
        <Sparkles className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">
          Invită 3 prieteni și primești {formatUsd(600)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Suzeta e gratuită și rămâne gratuită. Creștem doar prin oameni ca tine. Pentru fiecare
          prieten care intră cu linkul tău primești $2, iar el primește $1 — bani pe care îi
          transformi în produse cu logo Suzeta.
        </p>

        {code && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-surface p-3">
            <code className="flex-1 truncate text-left font-mono text-xs">{link}</code>
            <button onClick={copy} className="rounded-md p-1.5 hover:bg-muted" aria-label="Copiază">
              {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            </button>
          </div>
        )}

        <button
          onClick={share}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          <Share2 className="size-4" /> Trimite invitația
        </button>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <Link to="/wallet" className="text-primary underline">
            Vezi portofelul
          </Link>
          <button
            onClick={() => navigate({ to: "/nearby" })}
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            Mai târziu <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
