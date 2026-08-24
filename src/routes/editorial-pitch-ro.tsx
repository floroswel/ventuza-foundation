import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/editorial-pitch-ro")({
  head: () => ({
    meta: [
      { title: "Suzeta — dosar de nominalizare editorială pentru Google Play" },
      {
        name: "description",
        content:
          "Dosar de nominalizare editorială pentru Suzeta, aplicație LGBTQ+ safety-first făcută în România.",
      },
      { property: "og:url", content: "https://suzeta.app/editorial-pitch-ro" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/editorial-pitch-ro" }],
  }),
  component: EditorialPitchRo,
});

function EditorialPitchRo() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Înapoi la Suzeta
        </Link>

        <article className="prose prose-invert mx-auto mt-6 max-w-none text-sm leading-relaxed">
          <h1 className="text-2xl font-bold tracking-tight">
            Suzeta — dosar de nominalizare editorială pentru Google Play
          </h1>
          <p className="text-xs text-muted-foreground">
            Contact: contact@suzeta.ro · DPO: dpo@suzeta.ro
            <br />
            Pachet: <code>app.suzeta</code> · Site: https://www.suzeta.app
            <br />
            Categorie: Dating · Clasificare: 18+ · Țara de origine: România
          </p>

          <h2 className="mt-8 text-lg font-semibold">1. Într-un paragraf</h2>
          <p className="text-foreground/85">
            Suzeta este o aplicație de dating, prietenii și evenimente pentru comunitatea LGBTQ+ din
            România, făcută în România, în română și engleză. A apărut pentru că aplicațiile folosite
            azi de comunitate au fost gândite altundeva, pentru altcineva, și pun exact funcțiile de
            siguranță după paywall. La Suzeta toate sunt gratuite: mesaje nelimitate, like-urile
            primite, boost, travel mode, verificare, asistent AI. Aplicația se susține din
            parteneriate cu locuri și branduri LGBTQ-friendly, nu din abonamente, nu din rețele de
            reclame și niciodată din vânzarea datelor.
          </p>

          <h2 className="mt-8 text-lg font-semibold">2. De ce merită atenție</h2>
          <p className="text-foreground/85">
            România rămâne unul dintre locurile mai grele din Uniunea Europeană în care poți fi
            deschis queer. Un outing involuntar poate costa un job, o familie, o locuință. Faptul
            acesta a modelat fiecare decizie de produs:
          </p>
          <ul className="list-disc pl-5 text-foreground/85">
            <li>
              <strong>Locația exactă nu pleacă niciodată de pe telefon.</strong> Distanțele arătate
              altor utilizatori sunt bucketizate ("sub 1 km", "1 la 5 km"). Notificările de
              proximitate pentru locuri și evenimente se calculează pe dispozitiv. Nu se stochează
              istoric de poziții nicăieri.
            </li>
            <li>
              <strong>Anti-outing este un set de funcții, nu o bifă.</strong> Mod incognito, album
              privat cu deblocare unu-la-unu, comportament discret al aplicației, protecție la
              screenshot și control fin peste ce vede fiecare.
            </li>
            <li>
              <strong>Instrumente de siguranță la un tap.</strong> Buton de panică cu apel 112 și
              trimiterea locației către contacte de încredere, apel fals ca să poți pleca dintr-o
              situație proastă, ieșire rapidă, blocare cu PIN și biometrie, avertizare de risc când
              cineva călătorește într-o țară mai puțin sigură.
            </li>
            <li>
              <strong>Datele din categorii speciale sunt tratate ca atare.</strong> Informația
              opțională de sănătate este cifrată la nivel de coloană și se poate scrie doar după
              consimțământ explicit înregistrat. Retragerea consimțământului șterge datele în
              aceeași tranzacție.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold">3. Ce este nou aici</h2>
          <ol className="list-decimal pl-5 text-foreground/85">
            <li>
              <strong>Dating fără paywall, dar cu model de business.</strong> Tot ce se vinde de
              obicei ca Premium este gratuit pentru toți. Veniturile vin din portalul B2B, unde
              baruri, cluburi, cabinete și organizatori de evenimente plătesc pentru listare și
              promovare. Facturarea se face prin transfer bancar, cu confirmare manuală, deci nu
              există procesator de plăți care să atingă date de useri.
            </li>
            <li>
              <strong>Moderare umană înainte de publicare, nu după reclamații.</strong> Niciun
              venue, eveniment sau ofertă nu devine vizibil până când un moderator îl aprobă.
              Aprobarea este o singură acțiune server-side auditată; partenerul nu se poate
              auto-publica, iar regula este impusă în bază de date.
            </li>
            <li>
              <strong>Verificare fără colectare de act de identitate.</strong> Vârsta se verifică
              prin selfie live trimis unui procesator din UE care estimează vârsta și șterge
              imaginea imediat. Nu cerem, nu primim și nu stocăm documente.
            </li>
            <li>
              <strong>Un strat de comunitate, nu doar o grilă.</strong> Hartă cu locuri friendly
              verificate manual, calendar de evenimente construit în jurul Pride, party-urilor,
              workshop-urilor și meetup-urilor, plus un program de ambasadori care răsplătește
              oamenii care aduc prieteni în aplicație.
            </li>
          </ol>

          <h2 className="mt-8 text-lg font-semibold">4. Aliniere cu politicile de siguranță</h2>
          <ul className="list-disc pl-5 text-foreground/85">
            <li>
              <strong>Exclusiv 18+, impus tehnic.</strong> Verificarea de vârstă este obligatorie în
              producție și nu poate fi oprită din configurare. Funcțiile sociale sunt blocate la
              nivel de bază de date, nu doar ascunse în interfață.
            </li>
            <li>
              <strong>Siguranța copiilor.</strong> Toleranță zero pentru CSAM. Materialul suspectat
              nu este randat niciodată în produs, nici pentru staff; se lucrează pe hash și se
              escaladează la autorități. Pagini publice:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/child-safety">
                /child-safety
              </a>{" "}
              și{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/age-policy">
                /legal/age-policy
              </a>
            </li>
            <li>
              <strong>DSA.</strong> Punct unic de contact, flux de raportare conform Art. 16 și apel
              transparent conform Art. 20:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/dsa">
                /legal/dsa
              </a>
            </li>
            <li>
              <strong>GDPR.</strong> DPO desemnat, listă publică de subprocesatori, registru Art. 30
              intern, export de date Art. 20 și ștergere completă de cont.{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/privacy">
                /legal/privacy
              </a>{" "}
              ·{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/subprocessors">
                /legal/subprocessors
              </a>
            </li>
            <li>
              <strong>Fără advertising ID.</strong> Permisiunea <code>AD_ID</code> este eliminată
              explicit din manifestul final. Fără AdMob, fără tracking între aplicații, fără
              brokeri.
            </li>
            <li>
              <strong>Fără permisiune de locație în background.</strong> Proximitatea funcționează
              fără ea.
            </li>
            <li>
              <strong>Anti-abuz.</strong> Protecție anti-bot pe toate formularele de autentificare,
              fingerprinting de dispozitiv, limite de rată impuse în baza de date și blocare
              bilaterală aplicată de un trigger, nu de client.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold">5. Semnale de calitate tehnică</h2>
          <ul className="list-disc pl-5 text-foreground/85">
            <li>
              Build Android nativ cu edge-to-edge pentru Android 15 și mai nou, la nivelul de API
              cerut curent de Play.
            </li>
            <li>
              <code>FLAG_SECURE</code> împotriva capturilor și înregistrării de ecran pe ecranele
              sensibile, setări WebView întărite, certificate pinning în configurația de rețea,
              verificări de root și integritate.
            </li>
            <li>
              Suport offline, caching persistent, compresie de imagini la upload, lazy loading și
              code splitting, cu skeleton-uri pe primul ecran în loc de spinnere.
            </li>
            <li>Localizare completă română și engleză.</li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold">6. Ce cerem</h2>
          <p className="text-foreground/85">
            Luarea în considerare pentru plasare editorială în categoriile Dating și Social și
            pentru orice colecție Google Play care evidențiază produse safety-first, aplicații
            construite local sau aplicații care servesc comunități subreprezentate din Europa
            Centrală și de Est.
          </p>
          <p className="text-foreground/85">
            La cerere putem oferi un cont de reviewer pre-verificat, un tur demo, DPIA-ul și planul
            de răspuns la incidente.
          </p>

          <h2 className="mt-8 text-lg font-semibold">7. Kit de presă</h2>
          <ul className="list-disc pl-5 text-foreground/85">
            <li>
              Listare:{" "}
              <a
                className="text-primary underline"
                href="https://play.google.com/store/apps/details?id=app.suzeta"
              >
                play.google.com/store/apps/details?id=app.suzeta
              </a>
            </li>
            <li>
              Site:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app">
                www.suzeta.app
              </a>
            </li>
            <li>Feature graphic și icon: store-assets/</li>
            <li>Screenshots: store-assets/README.md</li>
            <li>
              Termeni:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/legal/terms">
                /legal/terms
              </a>
            </li>
            <li>
              Reguli de comunitate:{" "}
              <a
                className="text-primary underline"
                href="https://www.suzeta.app/community-guidelines"
              >
                /community-guidelines
              </a>
            </li>
            <li>
              Centru de siguranță:{" "}
              <a className="text-primary underline" href="https://www.suzeta.app/safety">
                /safety
              </a>
            </li>
          </ul>

          <hr className="my-8 border-border" />
          <p className="text-xs text-muted-foreground">
            Disponibil și în{" "}
            <Link to="/editorial-pitch-en" className="text-primary underline">
              engleză
            </Link>
            .
          </p>
        </article>
      </main>
    </div>
  );
}
