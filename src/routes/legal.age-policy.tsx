import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";
import { LegalHeader, useLegalLang } from "@/components/legal/LegalLang";
import { AgePolicyEn } from "@/components/legal/en/PolicyLegalEn";
import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";

export const Route = createFileRoute("/legal/age-policy")({
  head: () => ({
    meta: [
      { title: "Politica 18+ — Suzeta" },
      {
        name: "description",
        content:
          "Suzeta este o platformă exclusiv pentru adulți. Cum verificăm vârsta și ce facem dacă găsim un cont minor.",
      },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/legal/age-policy" }],
  }),
  component: AgePolicyPage,
});

function AgePolicyPage() {
  const [lang, setLang] = useLegalLang();
  return (
    <div className="min-h-dvh bg-background">
      <LegalHeader
        lang={lang}
        onLang={setLang}
        ro={"Politica 18+ (vârstă minimă)"}
        en={"18+ policy (minimum age)"}
      />

      {lang === "en" ? (
        <AgePolicyEn />
      ) : (
        <LegalDocOverride
          slug="age-policy"
          fallback={
            <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
              <p className="text-xs text-muted-foreground">Ultima actualizare: 27 iunie 2026</p>

              <h2 className="mt-6 text-base font-semibold">1. Serviciu exclusiv pentru adulți</h2>
              <p className="mt-2 text-foreground/85">
                {OPERATOR.brand} este o aplicație de dating și socializare destinată EXCLUSIV
                persoanelor de <strong>18 ani și peste</strong>. Aplicația este operată de{" "}
                {OPERATOR.legalName}. Crearea unui cont sau utilizarea aplicației de către minori
                este interzisă și constituie încălcare a Termenilor.
              </p>

              <h2 className="mt-6 text-base font-semibold">2. Mecanisme de verificare a vârstei</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
                <li>
                  <strong>La înregistrare</strong> — declarație 18+ explicită (checkbox) + data
                  nașterii cu validare client + server. Conturile cu vârstă calculată &lt; 18 sunt
                  refuzate, fără stocarea datei de naștere.
                </li>
                <li>
                  <strong>Age gate de rută</strong> — orice cont nou trece prin <em>AgeGate</em>{" "}
                  înainte de a accesa Discover, Mesaje sau Premium. În producție verificarea este
                  forțată ON indiferent de feature flags.
                </li>
                <li>
                  <strong>Estimare vârstă via Didit (procesator extern, UE)</strong> — capturăm un
                  selfie live cu challenge de gest (liveness) și îl trimitem tranzitoriu la{" "}
                  <strong>Didit</strong>, procesatorul nostru pentru <em>age estimation</em>. Didit
                  rulează un model de estimare a vârstei pe imagine, ne întoarce doar un verdict
                  pass/fail (18+ sau nu) și șterge imaginea imediat după emiterea rezultatului.{" "}
                  <strong>Nu solicităm și nu stocăm document de identitate</strong>. Procesarea are
                  loc în UE, cu temei GDPR Art. 9(2)(a) — consimțământ explicit pentru date
                  biometrice, înregistrat în <code>consent_log</code> înainte de captură. Vezi{" "}
                  <Link className="text-primary" to="/legal/subprocessors">
                    /legal/subprocessors
                  </Link>{" "}
                  pentru datele complete despre Didit.
                </li>
                <li>
                  <strong>Escaladare pentru raportări</strong> — dacă un cont este raportat pentru
                  suspiciune de minor, echipa Trust &amp; Safety re-cere verificarea Didit și, dacă
                  e necesar, suspendă preventiv contul până la o nouă estimare pass.
                </li>
                <li>
                  <strong>Detecție comportamentală</strong> — semnale (limbaj, fotografii,
                  raportări) escaladate automat către moderare. Conturile suspecte sunt suspendate
                  până la re-verificare.
                </li>
              </ul>

              <h2 className="mt-6 text-base font-semibold">
                3. Ce se întâmplă dacă găsim un cont minor
              </h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/85">
                <li>Contul este suspendat imediat și pus în izolare (no inbound/outbound).</li>
                <li>
                  Toate fotografiile sunt mutate într-un bucket carantină accesibil doar echipei
                  Trust &amp; Safety.
                </li>
                <li>
                  Dacă există indicii de CSAM, raportăm la{" "}
                  <a
                    className="text-primary"
                    href="https://safernet.ro"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Safernet.ro
                  </a>{" "}
                  și INHOPE; pentru SUA, raport către NCMEC. Hash-urile imaginilor intră în{" "}
                  <em>csam_blocklist</em>.
                </li>
                <li>
                  Contul este șters definitiv în maximum 7 zile, iar fingerprint-ul dispozitivului
                  este banat permanent (vezi <em>banned_fingerprints</em>).
                </li>
                <li>
                  Notificăm autoritatea competentă (DIICOT — combatere criminalitate informatică,
                  sau poliția locală) când există suspiciune de exploatare.
                </li>
              </ol>

              <h2 className="mt-6 text-base font-semibold">4. Raportează un cont minor</h2>
              <p className="mt-2 text-foreground/85">
                Folosește butonul <strong>„Raportează → Minor (sub 18 ani)"</strong> din orice
                profil sau mesaj. Pentru cazuri urgente:{" "}
                <a className="text-primary" href="mailto:abuse@suzeta.ro">
                  abuse@suzeta.ro
                </a>
                . Răspuns garantat în 24h. Pentru materiale CSAM:{" "}
                <a className="text-primary" href="mailto:csam@suzeta.ro">
                  csam@suzeta.ro
                </a>{" "}
                — monitorizat 24/7.
              </p>

              <h2 className="mt-6 text-base font-semibold">5. Părinți și tutori</h2>
              <p className="mt-2 text-foreground/85">
                Dacă suspectezi că un minor folosește Suzeta, scrie-ne la{" "}
                <a className="text-primary" href="mailto:parents@suzeta.ro">
                  parents@suzeta.ro
                </a>{" "}
                cu dovezi minime (capturi, ID dispozitiv, email cont). Suspendăm contul în 24h și
                ștergem datele conform Art. 8 GDPR (consimțământ minor invalid).
              </p>

              <h2 className="mt-6 text-base font-semibold">6. Conformitate</h2>
              <p className="mt-2 text-foreground/85">
                Politica respectă: GDPR Art. 8 (consimțământ minori), Legea 8/2008 (protecția
                copilului), Codul Penal român Art. 374 (pornografie infantilă), Regulamentul (UE)
                2022/2065 (DSA — Art. 28 privind protecția minorilor pe platforme online), Google
                Play Families Policy.
              </p>
              <h2 className="mt-6 text-base font-semibold">7. Operator</h2>
              <div className="mt-2">
                <OperatorIdentificationBlock compact />
              </div>
            </article>
          }
        />
      )}
    </div>
  );
}
