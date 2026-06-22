import { useEffect, useState } from "react";
import { Megaphone, ExternalLink } from "lucide-react";
import { fetchActiveAds, trackAd, type AdCampaign, type AdPlacement } from "@/lib/ads";

type Props = {
  placement: AdPlacement;
  city?: string;
  limit?: number;
};

export function SponsoredBanner({ placement, city, limit = 1 }: Props) {
  const [ads, setAds] = useState<AdCampaign[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchActiveAds(placement, city, limit).then((data) => {
      if (cancelled) return;
      setAds(data);
      data.forEach((ad) => trackAd(ad.id, "impression"));
    });
    return () => { cancelled = true; };
  }, [placement, city, limit]);

  if (!ads.length) return null;

  return (
    <div className="space-y-2">
      {ads.map((ad) => (
        <a
          key={ad.id}
          href={ad.cta_url ?? "#"}
          target="_blank"
          rel="noopener sponsored"
          onClick={() => trackAd(ad.id, "click")}
          className="block overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface transition hover:border-primary/60"
        >
          {ad.image_url && (
            <div
              className="h-32 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${ad.image_url})` }}
              aria-hidden
            />
          )}
          <div className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
              <Megaphone className="size-3" /> Sponsorizat
            </div>
            <p className="mt-1 text-sm font-semibold">{ad.title}</p>
            {ad.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ad.body}</p>}
            {ad.cta_url && (
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                {ad.cta_label ?? "Află mai mult"} <ExternalLink className="size-3" />
              </span>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
