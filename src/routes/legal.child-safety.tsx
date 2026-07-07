import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";

export const Route = createFileRoute("/legal/child-safety")({
  head: () => ({
    meta: [
      { title: "Child Safety Standards (CSAE) — Ventuza" },
      {
        name: "description",
        content:
          "Ventuza's published standards against child sexual abuse and exploitation (CSAE): zero-tolerance policy, prevention, detection, reporting and contact information. Available in English and Romanian.",
      },
      { property: "og:title", content: "Child Safety Standards (CSAE) — Ventuza" },
      {
        property: "og:description",
        content:
          "Zero tolerance for child sexual abuse and exploitation. How Ventuza prevents, detects and reports CSAE, and how to contact us.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://ventuza.app/legal/child-safety" },
    ],
    links: [{ rel: "canonical", href: "https://ventuza.app/legal/child-safety" }],
  }),
  component: ChildSafetyPage,
});

type Lang = "en" | "ro";

function ChildSafetyPage() {
  const { i18n } = useTranslation();
  const initial: Lang = (i18n.resolvedLanguage || i18n.language || "en").startsWith("ro")
    ? "ro"
    : "en";
  const [lang, setLang] = useState<Lang>(initial);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="flex-1 text-base font-semibold">
          {lang === "ro" ? "Standarde de siguranță a copiilor (CSAE)" : "Child Safety Standards (CSAE)"}
        </h1>
        <div
          className="inline-flex rounded-full border border-border/70 bg-surface/80 p-0.5 text-[10px]"
          role="group"
          aria-label="Language"
        >
          {(["ro", "en"] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setLang(lng)}
              className={`rounded-full px-2.5 py-1 uppercase tracking-wider transition-colors ${
                lang === lng
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={lang === lng}
            >
              {lng}
            </button>
          ))}
        </div>
      </header>

      <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        {lang === "en" ? <EnglishContent /> : <RomanianContent />}

        <h2 className="mt-6 text-base font-semibold">
          {lang === "ro" ? "Identificare operator & date legale" : "Operator & legal identification"}
        </h2>
        <div className="mt-2 not-prose">
          <OperatorIdentificationBlock />
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          {lang === "ro" ? "Politici asociate: " : "Related policies: "}
          <Link to="/legal/age-policy" className="text-primary underline">
            {lang === "ro" ? "Politică 18+" : "18+ policy"}
          </Link>
          ,{" "}
          <Link to="/legal/community" className="text-primary underline">
            {lang === "ro" ? "Reguli comunitate" : "Community Guidelines"}
          </Link>
          ,{" "}
          <Link to="/safety" className="text-primary underline">
            {lang === "ro" ? "Siguranță" : "Safety"}
          </Link>
          ,{" "}
          <Link to="/legal/dsa" className="text-primary underline">
            DSA
          </Link>
          ,{" "}
          <Link to="/legal/privacy" className="text-primary underline">
            {lang === "ro" ? "Politica de confidențialitate" : "Privacy Policy"}
          </Link>
          .
        </p>
      </article>
    </div>
  );
}

function EnglishContent() {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Last updated: 7 July 2026 · Published by {OPERATOR.legalName} · Applies to the{" "}
        {OPERATOR.brand} application on all platforms (Android, iOS, Web).
      </p>

      <p className="mt-4 text-foreground/85">
        This page is our externally published Child Safety Standards, describing how{" "}
        {OPERATOR.brand} prevents, detects, responds to and reports child sexual abuse and
        exploitation (CSAE), including child sexual abuse material (CSAM). It is maintained in
        accordance with Google Play's Child Safety Standards Policy for social and dating apps,
        the EU Digital Services Act, the Romanian Law 217/2003, and applicable international
        frameworks.
      </p>

      <h2 className="mt-6 text-base font-semibold">1. Zero-tolerance policy</h2>
      <p className="mt-2 text-foreground/85">
        {OPERATOR.brand} is an <strong>adults-only (18+)</strong> dating and community service.
        We have <strong>zero tolerance</strong> for CSAE and CSAM. Any account used to create,
        upload, request, share, promote, groom for, or otherwise engage in CSAE is{" "}
        <strong>permanently banned</strong>, its content preserved as required by law, and
        reported to competent authorities.
      </p>

      <h2 className="mt-6 text-base font-semibold">2. Age assurance — no minors</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>
          <strong>Mandatory 18+ declaration + date of birth</strong> at sign-up, validated
          client- and server-side. Under-18 accounts are refused; the birthdate is not stored
          for refused sign-ups.
        </li>
        <li>
          <strong>Age verification via Didit</strong> (EU-based processor, age estimation from
          a live selfie). Verification is mandatory in production and cannot be bypassed by
          feature flags. See{" "}
          <Link to="/legal/age-policy" className="text-primary underline">
            /legal/age-policy
          </Link>
          .
        </li>
        <li>
          <strong>DB-level enforcement</strong>: a server trigger rejects any profile with
          calculated age &lt; 18. Social RPCs (messages, discover, matches) refuse users whose{" "}
          <code>age_status</code> is not <code>verified</code>.
        </li>
        <li>
          If we discover a user is a minor, the account is{" "}
          <strong>terminated immediately</strong>, associated content removed, device and
          identifiers logged to prevent re-registration, and — where CSAE is suspected —
          reported per section 6.
        </li>
      </ul>

      <h2 className="mt-6 text-base font-semibold">3. Prevention by design</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>Adults-only marketing, store listing, and onboarding copy.</li>
        <li>
          No public profile discovery for unverified accounts; unverified users cannot send
          messages or media.
        </li>
        <li>
          <strong>Community Guidelines</strong> explicitly prohibit any sexual content,
          solicitation, grooming or discussion involving minors — see{" "}
          <Link to="/legal/community" className="text-primary underline">
            /legal/community
          </Link>
          .
        </li>
        <li>
          <strong>Profanity, grooming-language and CSAE-keyword filters</strong> on messages,
          profile text and media captions, with automatic escalation to the moderation queue.
        </li>
        <li>
          <strong>Perceptual + SHA-256 hash blocklist</strong> (<code>csam_blocklist</code>)
          matched on every media upload server-side. Known CSAM hashes are refused at upload;
          the raw image is never displayed to any operator.
        </li>
        <li>
          Rate limits, device fingerprinting and signup throttling to disrupt repeat offenders
          and evasion attempts.
        </li>
      </ul>

      <h2 className="mt-6 text-base font-semibold">4. Detection & moderation</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>
          Every uploaded image is scanned for known CSAM hashes and for adult-content
          classifiers before it becomes visible to other users.
        </li>
        <li>
          A <strong>24/7 in-app reporting mechanism</strong> is available on every profile,
          message, photo, event and venue (Report button → categories including "Child safety
          / CSAE"). Reports are prioritised and reviewed by trained moderators.
        </li>
        <li>
          Suspected CSAM is quarantined immediately; the media is{" "}
          <strong>never re-rendered</strong> in the moderation UI (only hashes are shown). See
          our internal CSAM no-render rule enforced at the database layer.
        </li>
        <li>
          Confirmed CSAE accounts are banned across all associated identifiers (email, phone,
          device, IP) to prevent re-registration.
        </li>
      </ul>

      <h2 className="mt-6 text-base font-semibold">5. Reporting to authorities</h2>
      <p className="mt-2 text-foreground/85">
        When we identify or receive a credible report of CSAM or child sexual exploitation, we:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/85">
        <li>Preserve the content, associated metadata and account records as evidence.</li>
        <li>
          Report to the{" "}
          <strong>US National Center for Missing &amp; Exploited Children (NCMEC) CyberTipline</strong>{" "}
          (
          <a
            href="https://report.cybertip.org"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            report.cybertip.org
          </a>
          ) where the applicable jurisdiction permits or requires.
        </li>
        <li>
          Report to the{" "}
          <strong>Romanian Police — Directorate for Combating Organized Crime (DCCO)</strong>{" "}
          and, where relevant, INHOPE / Internet Watch Foundation partners active in the
          European Union.
        </li>
        <li>
          Cooperate with valid legal requests from law enforcement and, where applicable, with
          our EU DSA point of contact obligations.
        </li>
        <li>Terminate the offending account and any linked accounts.</li>
      </ol>

      <h2 className="mt-6 text-base font-semibold">6. How to report to us</h2>
      <p className="mt-2 text-foreground/85">
        Anyone — user, parent, guardian, researcher, NGO or authority — can report suspected
        CSAE at any time:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>
          <strong>In-app</strong>: use the Report button on the offending profile, message,
          photo, event or venue and select "Child safety / CSAE".
        </li>
        <li>
          <strong>Dedicated CSAE email</strong>:{" "}
          <a href={`mailto:${OPERATOR.emails.csam}`} className="text-primary underline">
            {OPERATOR.emails.csam}
          </a>{" "}
          — monitored by our Trust &amp; Safety team.
        </li>
        <li>
          <strong>General abuse</strong>:{" "}
          <a href={`mailto:${OPERATOR.emails.abuse}`} className="text-primary underline">
            {OPERATOR.emails.abuse}
          </a>
        </li>
        <li>
          <strong>Parents / guardians</strong>:{" "}
          <a href={`mailto:${OPERATOR.emails.parents}`} className="text-primary underline">
            {OPERATOR.emails.parents}
          </a>
        </li>
        <li>
          <strong>Law enforcement requests</strong>:{" "}
          <a href={`mailto:${OPERATOR.emails.trust}`} className="text-primary underline">
            {OPERATOR.emails.trust}
          </a>
        </li>
      </ul>
      <p className="mt-2 text-foreground/85">
        We acknowledge CSAE reports within <strong>24 hours</strong> and act within{" "}
        <strong>72 hours</strong> at the latest. Emergencies involving a child in immediate
        danger should also be reported to local emergency services (in Romania and the EU:
        <strong> 112</strong>) and to the Romanian Child Helpline{" "}
        <strong>Telefonul Copilului — 116 111</strong>.
      </p>

      <h2 className="mt-6 text-base font-semibold">7. CSAE Point of Contact</h2>
      <p className="mt-2 text-foreground/85">
        Our designated CSAE point of contact is our Trust &amp; Safety team at{" "}
        <a href={`mailto:${OPERATOR.emails.csam}`} className="text-primary underline">
          {OPERATOR.emails.csam}
        </a>
        . For legal service and formal notices, use the operator address below.
      </p>

      <h2 className="mt-6 text-base font-semibold">8. Staff, training and accountability</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>
          Moderators handling child-safety reports receive documented training on CSAE
          identification, evidence preservation and wellbeing.
        </li>
        <li>
          All moderation actions are recorded in an append-only audit log (
          <code>admin_audit_log</code>); access to sensitive material follows a break-glass
          procedure with justification and independent audit review.
        </li>
        <li>
          We review this standard and our controls at least annually and after any material
          incident.
        </li>
      </ul>
    </>
  );
}

function RomanianContent() {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Ultima actualizare: 7 iulie 2026 · Publicat de {OPERATOR.legalName} · Se aplică
        aplicației {OPERATOR.brand} pe toate platformele (Android, iOS, Web).
      </p>

      <p className="mt-4 text-foreground/85">
        Această pagină reprezintă Standardele noastre de siguranță a copiilor, publicate
        extern, care descriu modul în care {OPERATOR.brand} previne, detectează, răspunde și
        raportează abuzul și exploatarea sexuală a copiilor (CSAE), inclusiv materialele de
        abuz sexual asupra copiilor (CSAM). Este menținută în conformitate cu Politica Google
        Play privind standardele de siguranță a copiilor pentru aplicații sociale și de
        dating, Actul UE privind serviciile digitale (DSA), Legea nr. 217/2003 din România și
        cadrele internaționale aplicabile.
      </p>

      <h2 className="mt-6 text-base font-semibold">1. Politică de toleranță zero</h2>
      <p className="mt-2 text-foreground/85">
        {OPERATOR.brand} este un serviciu de dating și comunitate{" "}
        <strong>exclusiv pentru adulți (18+)</strong>. Avem <strong>toleranță zero</strong>{" "}
        față de CSAE și CSAM. Orice cont folosit pentru a crea, încărca, solicita, distribui,
        promova, ademeni (grooming) sau angaja în orice alt mod în CSAE este{" "}
        <strong>banat permanent</strong>, conținutul este păstrat conform legii și raportat
        autorităților competente.
      </p>

      <h2 className="mt-6 text-base font-semibold">2. Verificarea vârstei — fără minori</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>
          <strong>Declarație obligatorie 18+ și data nașterii</strong> la înregistrare,
          validate atât client cât și server-side. Conturile sub 18 ani sunt refuzate; data
          nașterii nu este stocată pentru înregistrările refuzate.
        </li>
        <li>
          <strong>Verificare vârstă prin Didit</strong> (procesator UE, estimare a vârstei
          dintr-un selfie live). Verificarea este obligatorie în producție și nu poate fi
          ocolită prin feature flags. Vezi{" "}
          <Link to="/legal/age-policy" className="text-primary underline">
            /legal/age-policy
          </Link>
          .
        </li>
        <li>
          <strong>Enforcement la nivel de bază de date</strong>: un trigger server respinge
          orice profil cu vârstă calculată &lt; 18. RPC-urile sociale (mesaje, discover,
          match-uri) refuză utilizatorii al căror <code>age_status</code> nu este{" "}
          <code>verified</code>.
        </li>
        <li>
          Dacă descoperim că un utilizator este minor, contul este{" "}
          <strong>închis imediat</strong>, conținutul asociat este eliminat, dispozitivul și
          identificatorii sunt logate pentru a preveni reînregistrarea, iar — când există
          suspiciune de CSAE — raportăm conform secțiunii 6.
        </li>
      </ul>

      <h2 className="mt-6 text-base font-semibold">3. Prevenție prin design</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>Marketing, listare în magazine și texte de onboarding exclusiv pentru adulți.</li>
        <li>
          Fără descoperire publică a profilurilor pentru conturi neverificate; utilizatorii
          neverificați nu pot trimite mesaje sau media.
        </li>
        <li>
          <strong>Regulile comunității</strong> interzic explicit orice conținut sexual,
          solicitare, grooming sau discuții care implică minori — vezi{" "}
          <Link to="/legal/community" className="text-primary underline">
            /legal/community
          </Link>
          .
        </li>
        <li>
          <strong>Filtre de limbaj vulgar, grooming și cuvinte-cheie CSAE</strong> pe mesaje,
          text de profil și subtitrări media, cu escaladare automată în coada de moderare.
        </li>
        <li>
          <strong>Blocklist de hash-uri perceptuale + SHA-256</strong> (
          <code>csam_blocklist</code>) verificat server-side la fiecare upload de media.
          Hash-urile CSAM cunoscute sunt refuzate la upload; imaginea brută nu este niciodată
          afișată vreunui operator.
        </li>
        <li>
          Rate limits, fingerprinting de dispozitiv și throttling la înregistrare pentru a
          descuraja infractorii repetitivi și încercările de evaziune.
        </li>
      </ul>

      <h2 className="mt-6 text-base font-semibold">4. Detectare și moderare</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>
          Fiecare imagine încărcată este scanată pentru hash-uri CSAM cunoscute și pentru
          clasificatori de conținut pentru adulți înainte de a deveni vizibilă altor
          utilizatori.
        </li>
        <li>
          Un <strong>mecanism de raportare in-app disponibil 24/7</strong> există pe fiecare
          profil, mesaj, fotografie, eveniment și local (butonul Raportează → categorii
          incluzând „Siguranța copilului / CSAE"). Rapoartele sunt prioritizate și revizuite
          de moderatori instruiți.
        </li>
        <li>
          Materialul CSAM suspectat este pus în carantină imediat; media{" "}
          <strong>nu este niciodată re-randată</strong> în UI-ul de moderare (se afișează
          doar hash-urile). Vezi regula noastră internă CSAM no-render impusă la nivel de
          bază de date.
        </li>
        <li>
          Conturile CSAE confirmate sunt banate pe toți identificatorii asociați (email,
          telefon, dispozitiv, IP) pentru a preveni reînregistrarea.
        </li>
      </ul>

      <h2 className="mt-6 text-base font-semibold">5. Raportare către autorități</h2>
      <p className="mt-2 text-foreground/85">
        Când identificăm sau primim un raport credibil de CSAM sau exploatare sexuală a unui
        copil:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/85">
        <li>
          Păstrăm conținutul, metadatele asociate și înregistrările contului ca probe.
        </li>
        <li>
          Raportăm către{" "}
          <strong>
            US National Center for Missing &amp; Exploited Children (NCMEC) CyberTipline
          </strong>{" "}
          (
          <a
            href="https://report.cybertip.org"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            report.cybertip.org
          </a>
          ) unde jurisdicția aplicabilă permite sau impune.
        </li>
        <li>
          Raportăm către{" "}
          <strong>
            Poliția Română — Direcția de Combatere a Criminalității Organizate (DCCO)
          </strong>{" "}
          și, când e cazul, către partenerii INHOPE / Internet Watch Foundation activi în
          Uniunea Europeană.
        </li>
        <li>
          Cooperăm cu solicitări legale valide din partea autorităților și, unde este
          aplicabil, cu obligațiile noastre de punct de contact DSA la nivel UE.
        </li>
        <li>Închidem contul infractor și orice conturi asociate.</li>
      </ol>

      <h2 className="mt-6 text-base font-semibold">6. Cum ne raportezi</h2>
      <p className="mt-2 text-foreground/85">
        Oricine — utilizator, părinte, tutore, cercetător, ONG sau autoritate — poate raporta
        CSAE suspectat oricând:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>
          <strong>În aplicație</strong>: folosește butonul Raportează pe profilul, mesajul,
          fotografia, evenimentul sau localul respectiv și selectează „Siguranța copilului /
          CSAE".
        </li>
        <li>
          <strong>Email dedicat CSAE</strong>:{" "}
          <a href={`mailto:${OPERATOR.emails.csam}`} className="text-primary underline">
            {OPERATOR.emails.csam}
          </a>{" "}
          — monitorizat de echipa noastră Trust &amp; Safety.
        </li>
        <li>
          <strong>Abuz general</strong>:{" "}
          <a href={`mailto:${OPERATOR.emails.abuse}`} className="text-primary underline">
            {OPERATOR.emails.abuse}
          </a>
        </li>
        <li>
          <strong>Părinți / tutori</strong>:{" "}
          <a href={`mailto:${OPERATOR.emails.parents}`} className="text-primary underline">
            {OPERATOR.emails.parents}
          </a>
        </li>
        <li>
          <strong>Solicitări din partea autorităților</strong>:{" "}
          <a href={`mailto:${OPERATOR.emails.trust}`} className="text-primary underline">
            {OPERATOR.emails.trust}
          </a>
        </li>
      </ul>
      <p className="mt-2 text-foreground/85">
        Confirmăm rapoartele CSAE în <strong>24 de ore</strong> și acționăm în cel mult{" "}
        <strong>72 de ore</strong>. Urgențele care implică un copil în pericol imediat trebuie
        raportate și serviciilor locale de urgență (în România și UE:
        <strong> 112</strong>) și liniei telefonice pentru copii{" "}
        <strong>Telefonul Copilului — 116 111</strong>.
      </p>

      <h2 className="mt-6 text-base font-semibold">7. Punct de contact CSAE</h2>
      <p className="mt-2 text-foreground/85">
        Punctul nostru desemnat de contact CSAE este echipa Trust &amp; Safety la{" "}
        <a href={`mailto:${OPERATOR.emails.csam}`} className="text-primary underline">
          {OPERATOR.emails.csam}
        </a>
        . Pentru comunicări legale formale, folosește adresa operatorului de mai jos.
      </p>

      <h2 className="mt-6 text-base font-semibold">8. Personal, instruire și responsabilitate</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
        <li>
          Moderatorii care gestionează rapoarte de siguranță a copilului primesc instruire
          documentată privind identificarea CSAE, păstrarea probelor și starea de bine.
        </li>
        <li>
          Toate acțiunile de moderare sunt înregistrate într-un jurnal de audit append-only (
          <code>admin_audit_log</code>); accesul la materiale sensibile urmează o procedură
          break-glass cu justificare și revizuire independentă de audit.
        </li>
        <li>
          Revizuim acest standard și controalele noastre cel puțin anual și după orice
          incident material.
        </li>
      </ul>
    </>
  );
}
