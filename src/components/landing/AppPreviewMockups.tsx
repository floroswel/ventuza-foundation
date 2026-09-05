import { Heart, MapPin, EyeOff, Check } from "lucide-react";

/**
 * Previzualizări ale interfeței pentru pagina publică.
 *
 * De ce nu capturi reale: orice captură din aplicație ar conține profiluri
 * reale de membri (aplicație queer — risc de outing). Randăm în schimb rame
 * de telefon construite din aceleași token-uri de design ca aplicația, cu
 * date fictive și fără nicio fotografie de membru. Marcate ca ilustrații.
 */

function Phone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="w-44 shrink-0 snap-start sm:w-52">
      <div className="aspect-[9/19] w-full overflow-hidden rounded-[1.6rem] border border-border bg-card p-2">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.1rem] bg-background">
          {children}
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

function Tile({ initial, live }: { initial: string; live?: boolean }) {
  return (
    <div className="relative flex aspect-square items-center justify-center bg-muted">
      <span className="text-sm font-bold text-muted-foreground">{initial}</span>
      {live ? (
        <span className="absolute bottom-1 left-1 size-1.5 rounded-full bg-primary" aria-hidden />
      ) : null}
    </div>
  );
}

function DiscoverPreview() {
  return (
    <>
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-[10px] font-semibold tracking-tight">Discover</span>
        <MapPin className="size-3 text-muted-foreground" aria-hidden />
      </div>
      <div className="grid grid-cols-3 gap-px bg-border">
        {["A", "M", "R", "V", "D", "L", "S", "T", "C", "N", "B", "F"].map((i, idx) => (
          <Tile key={i} initial={i} live={idx % 4 === 0} />
        ))}
      </div>
      <div className="mt-auto flex items-center justify-around border-t border-border py-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-1.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`}
            aria-hidden
          />
        ))}
      </div>
    </>
  );
}

function ChatPreview() {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
          M
        </span>
        <span className="text-[10px] font-semibold tracking-tight">Mihai</span>
        <span className="ml-auto text-[8px] text-muted-foreground">~2 km</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="self-center rounded-full bg-muted px-2 py-0.5 text-[8px] text-muted-foreground">
          Azi
        </span>
        <span className="max-w-[80%] self-start rounded-xl rounded-bl-sm bg-muted px-2 py-1 text-[9px] leading-snug">
          Salut! Cum e seara ta?
        </span>
        <span className="max-w-[80%] self-end rounded-xl rounded-br-sm bg-primary px-2 py-1 text-[9px] leading-snug text-primary-foreground">
          Liniștită. Bem o cafea mâine?
        </span>
        <span className="flex items-center gap-0.5 self-end text-[7px] text-muted-foreground">
          Citit <Check className="size-2" aria-hidden />
        </span>
      </div>
      <div className="m-2 rounded-full border border-border px-2 py-1 text-[8px] text-muted-foreground">
        Scrie un mesaj…
      </div>
    </>
  );
}

function PrivacyPreview() {
  const rows = [
    { label: "Ascunde vârsta", on: true },
    { label: "Ascunde distanța", on: true },
    { label: "Mod discret", on: false },
    { label: "Notificări", on: true },
  ];
  return (
    <>
      <div className="flex items-center gap-1 border-b border-border px-2 py-2">
        <EyeOff className="size-3 text-primary" aria-hidden />
        <span className="text-[10px] font-semibold tracking-tight">Confidențialitate</span>
      </div>
      <ul className="flex flex-col gap-1.5 p-2">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between rounded-lg border border-border px-2 py-1.5"
          >
            <span className="text-[9px]">{r.label}</span>
            <span
              className={`flex h-3 w-6 items-center rounded-full px-0.5 ${r.on ? "justify-end bg-primary" : "justify-start bg-muted"}`}
              aria-hidden
            >
              <span className="size-2 rounded-full bg-background" />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-auto border-t border-border p-2 text-[8px] leading-snug text-muted-foreground">
        Coordonatele exacte nu părăsesc niciodată contul tău.
      </p>
    </>
  );
}

function MatchPreview() {
  return (
    <>
      <div className="flex items-center gap-1 border-b border-border px-2 py-2">
        <Heart className="size-3 text-primary" aria-hidden />
        <span className="text-[10px] font-semibold tracking-tight">Potriviri</span>
      </div>
      <ul className="flex flex-col">
        {[
          ["A", "Potrivire nouă", "acum"],
          ["R", "Ți-a dat tap", "12 min"],
          ["V", "Ți-a vizitat profilul", "1 h"],
          ["D", "Te-a salvat la favorite", "3 h"],
        ].map(([i, t, s]) => (
          <li key={t} className="flex items-center gap-2 border-b border-border px-2 py-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
              {i}
            </span>
            <span className="text-[9px]">{t}</span>
            <span className="ml-auto text-[8px] text-muted-foreground">{s}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function AppPreviewMockups() {
  return (
    <div>
      <div
        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2"
        style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
      >
        <Phone label="Discover">
          <DiscoverPreview />
        </Phone>
        <Phone label="Chat">
          <ChatPreview />
        </Phone>
        <Phone label="Matches">
          <MatchPreview />
        </Phone>
        <Phone label="Privacy">
          <PrivacyPreview />
        </Phone>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Interface illustrations. No real member profiles or photos are shown.
      </p>
    </div>
  );
}

export default AppPreviewMockups;
