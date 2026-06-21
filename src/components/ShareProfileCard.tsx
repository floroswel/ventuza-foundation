import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2, Check } from "lucide-react";
import { toast } from "sonner";

type Props = { slug: string | null; displayName: string | null };

export function ShareProfileCard({ slug, displayName }: Props) {
  const [copied, setCopied] = useState(false);
  if (!slug) return null;
  const url = `${typeof window !== "undefined" ? window.location.origin : "https://ventuza.com"}/u/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiat.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Nu am putut copia.");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${displayName ?? "Profilul meu"} · Ventuza`, url });
      } catch {/* user cancelled */}
    } else {
      copy();
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Share2 className="size-4 text-primary" />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Share profile</p>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="rounded-xl bg-white p-2.5">
          <QRCodeSVG value={url} size={96} bgColor="#ffffff" fgColor="#000000" level="M" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={share}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <Share2 className="size-3.5" /> Share
            </button>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs"
            >
              {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              {copied ? "Copiat" : "Copiază"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
