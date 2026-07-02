import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, Trash2, Eye, EyeOff } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/legal/data-safety")({
  head: () => ({
    meta: [
      { title: "Siguranța datelor — Ventuza" },
      {
        name: "description",
        content:
          "Ce date colectăm, de ce, dacă sunt opționale sau obligatorii și cum le poți controla. Sincron cu formularul Data Safety din Google Play.",
      },
      { property: "og:title", content: "Siguranța datelor — Ventuza" },
      {
        property: "og:description",
        content: "Transparență completă asupra datelor Ventuza — categorii, scop, control.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataSafetyPage,
});

type DataItem = {
  category: string;
  types: string[];
  purpose: string;
  optional: boolean;
  shared: boolean;
  encryptedInTransit: boolean;
  encryptedAtRest?: boolean;
  userDeletable: boolean;
  howToControl: string;
  controlHref?: string;
  processors?: string[];
  art9?: boolean;
};

// Oglindeste declaratia din Google Play Console → Data Safety.
// Modificarea aici trebuie să fie sincronă cu Data Safety form ȘI cu
// docs/gdpr-art-30-register.md (vezi AGENTS.md → REGULĂ REGISTRU ART. 30).
const ITEMS: DataItem[] = [
  {
    category: "Informații personale",
    types: ["Nume / display name", "Email", "Data nașterii", "Fotografie profil"],
    purpose: "Identificare cont, comunicare, verificare 18+.",
    optional: false,
    shared: false,
    encryptedInTransit: true,
    encryptedAtRest: true,
    userDeletable: true,
    howToControl: "Editează în Profil sau șterge contul din Setări.",
    controlHref: "/profile",
  },
  {
    category: "Orientare, gen, pronume, triburi",
    types: ["Orientare sexuală", "Gen", "Pronume", "Triburi / interese"],
    purpose:
      "Funcționalitate esențială de matching pe o aplicație LGBTQ+. Câmpuri opționale, ascunse implicit pentru publicul general.",
    optional: true,
    shared: false,
    encryptedInTransit: true,
    encryptedAtRest: true,
    userDeletable: true,
    art9: true,
    howToControl: "Editează sau lasă gol în Profil. Break-glass admin logat.",
    controlHref: "/profile",
  },
  {
    category: "Locație aproximativă",
    types: ["Bucket de distanță (>500 m)", "Oraș"],
    purpose:
      "Afișare useri și evenimente în apropiere. Coordonatele exacte NU pleacă la server pentru alți useri.",
    optional: false,
    shared: false,
    encryptedInTransit: true,
    userDeletable: true,
    howToControl: "Dezactivează permisiunea de locație din OS sau dezactivează Discover.",
    controlHref: "/settings",
  },
  {
    category: "Locație în fundal (geofencing)",
    types: ["Detecție proximitate venue/eveniment cu app închisă"],
    purpose:
      "Notificare când treci pe lângă un loc aprobat. Calcul pe dispozitiv — coordonatele NU se stochează, NU se transmit.",
    optional: true,
    shared: false,
    encryptedInTransit: true,
    userDeletable: true,
    howToControl: "Toggle „Locație în fundal” din Setări → Consimțăminte. Opt-in explicit.",
    controlHref: "/settings",
  },
  {
    category: "Fotografii",
    types: ["Poze de profil (până la 6)", "Album privat opțional"],
    purpose:
      "Afișare profil. Moderare AI (blocantă) + hash perceptual (anti-catfishing / anti-CSAM).",
    optional: false,
    shared: false,
    encryptedInTransit: true,
    encryptedAtRest: true,
    userDeletable: true,
    howToControl: "Șterge sau înlocuiește din Profil. Album privat controlat de tine.",
    controlHref: "/profile",
    processors: ["P7 — Lovable AI Gateway (moderare)"],
  },
  {
    category: "Mesaje",
    types: ["Text", "Media atașată (poze / voice)"],
    purpose: "Comunicare 1:1 și în grupuri. Nu sunt vândute, nu antrenăm AI pe ele.",
    optional: false,
    shared: false,
    encryptedInTransit: true,
    encryptedAtRest: true,
    userDeletable: true,
    howToControl: "Șterge mesaje individual sau întreaga conversație. Ștergerea contului le elimină.",
    controlHref: "/messages",
  },
  {
    category: "Selfie verificare vârstă",
    types: ["Imagine biometrică pentru estimare vârstă"],
    purpose: "Confirmare 18+ prin Didit (procesator UE). Imaginea se șterge la Didit ≤30 zile.",
    optional: true,
    shared: true,
    encryptedInTransit: true,
    encryptedAtRest: true,
    userDeletable: true,
    art9: true,
    howToControl:
      "Consimțământ „Verificare vârstă” în Setări. Retragerea blochează re-verificarea.",
    controlHref: "/settings",
    processors: ["P6 — Didit"],
  },
  {
    category: "Input pentru funcții AI",
    types: ["Text bio", "Text openere", "Poze pentru photo coach"],
    purpose:
      "Doar când folosești butoanele AI (bio, openere, traduceri, coach). Transmis către Lovable AI Gateway.",
    optional: true,
    shared: true,
    encryptedInTransit: true,
    userDeletable: false,
    howToControl:
      "Consimțământ „Funcții AI” în Setări. Retragerea dezactivează instant butoanele AI.",
    controlHref: "/settings",
    processors: ["P7 — Lovable AI Gateway"],
  },
  {
    category: "Notificări push",
    types: ["Token dispozitiv (FCM/APNs)"],
    purpose: "Livrare notificări pentru mesaje, match-uri, evenimente.",
    optional: true,
    shared: true,
    encryptedInTransit: true,
    userDeletable: true,
    howToControl: "Toggle „Notificări push” în Setări. Retragerea dezabonează dispozitivul.",
    controlHref: "/settings",
    processors: ["P4 — FCM/APNs"],
  },
  {
    category: "Identificatori de dispozitiv & activitate",
    types: ["Amprentă browser", "IP (rate limit / anti-fraudă)", "Log evenimente app"],
    purpose: "Anti-bot, anti-fraudă, siguranță, debugging.",
    optional: false,
    shared: false,
    encryptedInTransit: true,
    userDeletable: true,
    howToControl: "Șterse la ștergerea contului. Log-urile de securitate se păstrează 90 zile.",
  },
  {
    category: "Facturare parteneri B2B",
    types: ["Denumire firmă", "CUI", "Adresă sediu", "Email facturare"],
    purpose: "Emitere facturi (Portal Partener). Nu se aplică userilor obișnuiți.",
    optional: true,
    shared: false,
    encryptedInTransit: true,
    encryptedAtRest: true,
    userDeletable: false,
    howToControl:
      "Doar pentru conturile parteneri. Legal: păstrate 10 ani (Codul Fiscal RO).",
  },
];

function DataSafetyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <div className="mb-4">
        <BackButton fallback="/settings" />
      </div>

      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <ShieldCheck className="size-4" /> Data Safety
        </div>
        <h1 className="text-2xl font-semibold">Siguranța datelor tale</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Această pagină este întreținută de VOMIX GENIUS S.R.L. pentru Ventuza și oglindește exact
          declarația din formularul <em>Data Safety</em> din Google Play Console. Fără marketing,
          fără termeni ambigui — categorii, scop, control.
        </p>
      </header>

      <div className="mb-6 grid gap-2 rounded-2xl border border-border bg-surface p-4 text-xs">
        <Legend icon={<Lock className="size-3.5" />} label="Criptat în tranzit" tone="ok" />
        <Legend
          icon={<Lock className="size-3.5" />}
          label="Criptat în repaus (unde e marcat)"
          tone="ok"
        />
        <Legend
          icon={<Trash2 className="size-3.5" />}
          label="Poți cere ștergerea (individual sau prin ștergerea contului)"
          tone="ok"
        />
        <Legend
          icon={<EyeOff className="size-3.5" />}
          label="Nu vindem date. Nu partajăm pentru advertising terț."
          tone="ok"
        />
      </div>

      <div className="space-y-3">
        {ITEMS.map((item) => (
          <article
            key={item.category}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{item.category}</h2>
              {item.art9 && (
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                  GDPR Art. 9
                </span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  item.optional
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {item.optional ? "Opțional" : "Necesar pentru serviciu"}
              </span>
              {item.shared ? (
                <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                  <Eye className="size-3" /> Partajat cu procesator
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  <EyeOff className="size-3" /> Nu se partajează
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Ce colectăm:</strong> {item.types.join(", ")}.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong className="text-foreground">De ce:</strong> {item.purpose}
            </p>

            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {item.encryptedInTransit && (
                <span className="flex items-center gap-1">
                  <Lock className="size-3" /> Criptat în tranzit
                </span>
              )}
              {item.encryptedAtRest && (
                <span className="flex items-center gap-1">
                  <Lock className="size-3" /> Criptat în repaus
                </span>
              )}
              {item.userDeletable && (
                <span className="flex items-center gap-1">
                  <Trash2 className="size-3" /> Poți cere ștergerea
                </span>
              )}
            </div>

            {item.processors && (
              <p className="mt-2 text-[11px] text-muted-foreground/80">
                Procesatori: {item.processors.join(" · ")} — vezi{" "}
                <Link to="/legal/subprocessors" className="underline">
                  lista completă
                </Link>
                .
              </p>
            )}

            <div className="mt-3 rounded-lg border border-dashed border-border bg-background/40 px-3 py-2 text-[12px]">
              <strong className="text-foreground">Cum controlezi:</strong> {item.howToControl}
              {item.controlHref && (
                <>
                  {" "}
                  <Link to={item.controlHref} className="text-primary underline">
                    Deschide setările
                  </Link>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      <footer className="mt-8 space-y-2 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Nu partajăm datele cu terțe părți pentru publicitate.</strong>{" "}
          Advertising-ul intern (parteneri Ventuza) folosește doar oraș + interese generice, fără
          identificatori personali.
        </p>
        <p>
          Detalii complete despre baze legale și retenție:{" "}
          <Link to="/legal/privacy" className="underline">
            Politica de confidențialitate
          </Link>{" "}
          ·{" "}
          <Link to="/legal/subprocessors" className="underline">
            Subprocesatori
          </Link>{" "}
          ·{" "}
          <Link to="/legal/records-of-processing" className="underline">
            Registrul Art. 30
          </Link>
          .
        </p>
        <p>
          Cerere de export sau ștergere:{" "}
          <Link to="/settings" className="underline">
            Setări → Datele mele
          </Link>{" "}
          sau{" "}
          <Link to="/account-deletion" className="underline">
            /account-deletion
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}

function Legend({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "ok" | "warn";
}) {
  return (
    <div
      className={`flex items-center gap-2 ${
        tone === "ok" ? "text-emerald-600" : "text-amber-600"
      }`}
    >
      {icon}
      <span className="text-foreground">{label}</span>
    </div>
  );
}
