import { QRCodeSVG } from "qrcode.react";
import { storeUrlForPlatform } from "@/lib/store-links";

/**
 * Desktop-only QR block: visitors on a laptop can send the app to their phone
 * without typing a URL (same pattern Grindr and Hornet use on their homepage).
 */
export function DownloadQr() {
  return (
    <div className="mt-8 hidden items-center gap-4 rounded-xl border border-border bg-card p-4 text-left sm:flex">
      <div className="rounded-lg bg-white p-2">
        <QRCodeSVG value={storeUrlForPlatform("hero_qr")} size={88} level="M" />
      </div>
      <div>
        <p className="text-sm font-semibold tracking-tight">Scan to install on your phone</p>
        <p className="mt-1 max-w-[42ch] text-xs leading-relaxed text-muted-foreground">
          Point your camera at the code to open Suzeta on Google Play. Free, no ads on the profile
          grid, and you can delete everything at any time.
        </p>
      </div>
    </div>
  );
}
