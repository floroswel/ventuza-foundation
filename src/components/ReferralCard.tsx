import { useEffect, useState } from "react";
import { Gift, Copy, Share2, Check } from "lucide-react";
import { getMyReferralCode, referralLink, redeemReferral } from "@/lib/referrals";
import { toast } from "sonner";

export function ReferralCard() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    getMyReferralCode().then(setCode);
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
          title: "Ventuza",
          text: "Hai pe Ventuza — primești 100 XP",
          url: link,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      await copy();
    }
  }

  async function handleRedeem() {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    const res = await redeemReferral(redeemCode.trim());
    setRedeeming(false);
    if (res.ok) {
      toast.success(`+${res.reward_xp ?? 100} XP!`);
      setRedeemCode("");
    } else {
      const msgs: Record<string, string> = {
        invalid_code: "Cod invalid",
        self_referral: "Nu poți folosi propriul cod",
        already_redeemed: "Ai folosit deja un cod",
        not_authenticated: "Trebuie să fii autentificat",
      };
      toast.error(msgs[res.error ?? ""] ?? res.error ?? "Eroare");
    }
  }

  return (
    <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4">
      <div className="mb-2 flex items-center gap-2">
        <Gift className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Invită prieteni · primești 100 XP</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Pentru fiecare prieten care intră cu codul tău, primiți amândoi 100 XP.
      </p>
      {code && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-background/80 p-2">
          <code className="flex-1 truncate text-sm font-mono">{code}</code>
          <button
            onClick={copy}
            className="rounded-md p-1.5 hover:bg-muted"
            aria-label="Copiază link"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button onClick={share} className="rounded-md p-1.5 hover:bg-muted" aria-label="Share">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={redeemCode}
          onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
          placeholder="Ai un cod? Introdu-l aici"
          maxLength={16}
          className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
        />
        <button
          onClick={handleRedeem}
          disabled={redeeming || !redeemCode.trim()}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {redeeming ? "..." : "Folosește"}
        </button>
      </div>
    </section>
  );
}
