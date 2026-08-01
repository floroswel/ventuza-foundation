import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicFooter } from "@/components/PublicFooter";

const CONTACT = "contact@vomixgenius.ro";

export const Route = createFileRoute("/child-safety")({
  head: () => ({
    meta: [
      { title: "Child Safety Standards (CSAE) — Suzeta" },
      {
        name: "description",
        content:
          "Suzeta child safety standards: 18+ only, zero tolerance for child sexual abuse and exploitation (CSAE/CSAM), in-app reporting, blocking, account removal and reporting to competent authorities.",
      },
      { property: "og:title", content: "Child Safety Standards (CSAE) — Suzeta" },
      {
        property: "og:description",
        content:
          "Suzeta is an adults-only (18+) app with a zero-tolerance policy for child sexual abuse and exploitation.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://suzeta.app/child-safety" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/child-safety" }],
  }),
  component: ChildSafetyPublicPage,
});

function ChildSafetyPublicPage() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-relaxed text-foreground/85">
        <h1 className="text-2xl font-semibold text-foreground">
          Suzeta — Standarde de siguranță a copiilor (CSAE)
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Child Safety Standards for the Suzeta application · English version below
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">1. Despre Suzeta</h2>
        <p className="mt-2">
          Suzeta este o aplicație de dating și comunitate destinată{" "}
          <strong>exclusiv persoanelor de minimum 18 ani</strong>. Accesul minorilor este
          interzis. La înregistrare se solicită data nașterii și o declarație 18+; conturile
          identificate ca aparținând unor persoane sub 18 ani sunt închise.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">
          2. Toleranță zero față de CSAE
        </h2>
        <p className="mt-2">
          Suzeta aplică o politică de <strong>toleranță zero</strong> față de abuzul și
          exploatarea sexuală a copiilor (CSAE). Sunt strict interzise:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            materialele de abuz sexual asupra copiilor (CSAM) — încărcare, distribuire,
            solicitare, promovare sau linkuri către astfel de materiale;
          </li>
          <li>groomingul (ademenirea unui minor în scop sexual);</li>
          <li>sextortionul și șantajul sexual;</li>
          <li>traficul sexual al minorilor;</li>
          <li>
            orice altă conduită care sexualizează, expune sau pune în pericol un copil, inclusiv
            solicitarea de imagini sau întâlniri.
          </li>
        </ul>

        <h2 className="mt-8 text-base font-semibold text-foreground">
          3. Raportare în aplicație și blocare
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Orice profil, mesaj, fotografie sau conținut poate fi raportat direct din aplicație,
            prin butonul de raportare, cu o categorie dedicată siguranței copiilor.
          </li>
          <li>
            Orice utilizator poate <strong>bloca</strong> un alt utilizator; blocarea oprește
            imediat orice contact între cele două conturi.
          </li>
          <li>
            Rapoartele pot fi trimise și prin e-mail, de către utilizatori, părinți, organizații
            sau autorități, la adresa de mai jos.
          </li>
        </ul>

        <h2 className="mt-8 text-base font-semibold text-foreground">4. Cum reacționăm</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Rapoartele privind siguranța copiilor sunt tratate cu prioritate maximă.</li>
          <li>
            Conținutul ilegal este analizat de echipa noastră și <strong>eliminat rapid</strong>{" "}
            atunci când raportul se confirmă.
          </li>
          <li>
            Conturile implicate sunt <strong>suspendate sau închise definitiv</strong>.
          </li>
          <li>
            Păstrăm dovezile relevante (conținut, metadate, date de cont) atât cât este necesar
            conform legii, pentru a putea răspunde solicitărilor autorităților.
          </li>
          <li>
            Raportăm cazurile către autoritățile regionale și naționale competente atunci când
            legea aplicabilă ne impune acest lucru și răspundem solicitărilor legale valide.
          </li>
          <li>
            Cooperăm cu Google Play și cu autoritățile competente în investigarea cazurilor de
            CSAE.
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Notă de transparență: moderarea conținutului raportat este realizată de echipa umană a
          Suzeta. Nu pretindem că folosim sisteme automate de detectare a CSAM și nu avem
          parteneriate formale încheiate cu organizații sau autorități.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">
          5. Punct de contact pentru siguranța copiilor
        </h2>
        <p className="mt-2">
          Punctul nostru de contact pentru sesizări privind siguranța copiilor și CSAE:{" "}
          <a href={`mailto:${CONTACT}`} className="text-primary underline">
            {CONTACT}
          </a>
        </p>
        <p className="mt-2">
          Dacă un copil este în pericol imediat, contactați serviciile de urgență (în România și
          UE: <strong>112</strong>).
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">6. Documente conexe</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <Link to="/legal/privacy" className="text-primary underline">
              Politica de confidențialitate
            </Link>{" "}
            — https://suzeta.app/legal/privacy
          </li>
          <li>
            <Link to="/legal/terms" className="text-primary underline">
              Termeni și condiții
            </Link>{" "}
            — https://suzeta.app/legal/terms
          </li>
          <li>
            <Link to="/community-guidelines" className="text-primary underline">
              Regulile comunității
            </Link>{" "}
            — https://suzeta.app/community-guidelines
          </li>
        </ul>

        <hr className="my-10 border-border" />

        <h2 className="text-xl font-semibold text-foreground">
          Suzeta — Child Safety Standards (English)
        </h2>
        <p className="mt-3">
          <strong>Suzeta</strong> is a dating and community application intended{" "}
          <strong>exclusively for adults aged 18 and over</strong>. Minors are not permitted to
          use the service.
        </p>
        <p className="mt-3">
          Suzeta has a <strong>zero-tolerance policy</strong> towards child sexual abuse and
          exploitation (CSAE). Child sexual abuse material (CSAM) is absolutely prohibited, as
          are grooming, sextortion, child sex trafficking and any other conduct that sexualises
          or endangers children.
        </p>
        <p className="mt-3">
          Users can report any profile, message or content directly in the app and can block
          other users. Reported illegal content is reviewed by our team and removed quickly;
          accounts involved are suspended or permanently terminated. We preserve evidence as
          required by law, report cases to the competent regional and national authorities where
          the law requires it, and cooperate with Google Play and competent authorities.
        </p>
        <p className="mt-3">
          Transparency note: moderation is performed by our human team. We do not claim automated
          CSAM detection and we have no formal partnerships with organisations or authorities.
        </p>
        <p className="mt-3">
          Child safety point of contact:{" "}
          <a href={`mailto:${CONTACT}`} className="text-primary underline">
            {CONTACT}
          </a>
        </p>
        <p className="mt-3">
          Related documents:{" "}
          <Link to="/legal/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
          ,{" "}
          <Link to="/legal/terms" className="text-primary underline">
            Terms of Service
          </Link>
          ,{" "}
          <Link to="/community-guidelines" className="text-primary underline">
            Community Guidelines
          </Link>
          .
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
