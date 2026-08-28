import { ImageOff } from "lucide-react";

/**
 * Galerie orizontală de capturi din aplicație.
 *
 * Nu inventăm imagini: dacă fișierul lipsește din `public/screenshots/`,
 * afișăm un placeholder marcat clar. Containerul este singurul care
 * defilează lateral (`overflow-x-auto`); body-ul rămâne fix.
 */
export type Shot = {
  /** Cale publică, ex. `/screenshots/discover.jpg`. Gol = placeholder. */
  src?: string;
  label: string;
  /** Numele fișierului așteptat, afișat în placeholder. */
  expectedFile: string;
};

export function ScreenshotGallery({ shots }: { shots: Shot[] }) {
  return (
    <div
      className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2"
      style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
    >
      {shots.map((shot) => (
        <figure key={shot.label} className="w-40 shrink-0 snap-start sm:w-48">
          {shot.src ? (
            <img
              src={shot.src}
              alt={`Suzeta — ${shot.label}`}
              width={320}
              height={640}
              loading="lazy"
              decoding="async"
              className="aspect-[9/19] w-full rounded-xl border border-border object-cover"
            />
          ) : (
            <div className="flex aspect-[9/19] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 text-center">
              <ImageOff className="size-5 text-muted-foreground" aria-hidden />
              <span className="text-[11px] leading-tight text-muted-foreground">
                Screenshot missing
                <br />
                <code className="break-all">{shot.expectedFile}</code>
              </span>
            </div>
          )}
          <figcaption className="mt-2 text-xs text-muted-foreground">{shot.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
