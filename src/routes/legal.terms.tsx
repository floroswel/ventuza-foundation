import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Termeni și condiții — Ventuza" },
      { name: "description", content: "Termenii de utilizare a aplicației Ventuza pentru întâlniri." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Termeni și condiții</h1>
      </header>

      <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Ultima actualizare: 20 iunie 2026</p>

        <h2 className="mt-6 text-base font-semibold">1. Acceptarea termenilor</h2>
        <p className="mt-2 text-foreground/85">
          Prin crearea unui cont Ventuza confirmi că ai cel puțin <strong>18 ani</strong>, ai capacitatea legală de a încheia
          acest acord și ești de acord cu termenii de mai jos. Dacă nu ești de acord, te rugăm să nu folosești aplicația.
        </p>

        <h2 className="mt-6 text-base font-semibold">2. Natura serviciului</h2>
        <p className="mt-2 text-foreground/85">
          Ventuza este o platformă pentru întâlniri și socializare adresată comunității LGBTQ+. Oferim instrumente pentru
          crearea unui profil, descoperirea altor utilizatori, mesagerie privată și evenimente. Nu garantăm că vei găsi
          un partener, o relație sau orice rezultat specific.
        </p>

        <h2 className="mt-6 text-base font-semibold">3. Conduita utilizatorilor</h2>
        <p className="mt-2 text-foreground/85">Este strict interzis să:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
          <li>Te dai drept altă persoană sau să folosești fotografii care nu îți aparțin.</li>
          <li>Postezi conținut sexual explicit, nuditate, minori, violență sau materiale ilegale.</li>
          <li>Hărțuiești, ameninți, șantajezi sau discriminezi alți utilizatori.</li>
          <li>Soliciți bani, servicii sexuale plătite sau promovezi escortă.</li>
          <li>Distribui datele personale ale altor utilizatori în afara aplicației.</li>
          <li>Folosești aplicația pentru spam, phishing sau scopuri comerciale neautorizate.</li>
        </ul>
        <p className="mt-2 text-foreground/85">
          Încălcările pot duce la suspendarea sau ștergerea imediată a contului, fără preaviz, și raportarea către autorități
          competente unde este cazul.
        </p>

        <h2 className="mt-6 text-base font-semibold">4. Conținutul tău</h2>
        <p className="mt-2 text-foreground/85">
          Tu ești proprietarul fotografiilor și textelor pe care le încarci. Acordi Ventuza o licență neexclusivă, mondială,
          gratuită, pentru a stoca, afișa și transmite acest conținut în scopul funcționării serviciului. Folosim moderare
          automată (AI) pentru a detecta conținut nepermis înainte de publicare.
        </p>

        <h2 className="mt-6 text-base font-semibold">5. Status HIV și date sensibile</h2>
        <p className="mt-2 text-foreground/85">
          Câmpul de status HIV este <strong>opțional</strong> și complet la latitudinea ta. Aceste informații sunt tratate
          ca date de sănătate sensibile sub GDPR (Art. 9). Prin completarea lor consimți explicit la prelucrarea și afișarea
          lor altor utilizatori ai aplicației.
        </p>

        <h2 className="mt-6 text-base font-semibold">6. Abonament Premium</h2>
        <p className="mt-2 text-foreground/85">
          Funcțiile Premium se achiziționează prin Google Play. Tranzacțiile, taxele și politica de refund sunt gestionate
          de Google conform termenilor săi. Abonamentele se reînnoiesc automat până când le anulezi din contul tău Google
          Play, cel târziu cu 24h înainte de sfârșitul perioadei.
        </p>

        <h2 className="mt-6 text-base font-semibold">7. Suspendare și ștergere</h2>
        <p className="mt-2 text-foreground/85">
          Îți poți șterge contul oricând din <em>Setări → Șterge cont</em>. Datele vor fi eliminate definitiv în maximum 30
          de zile. Ne rezervăm dreptul de a suspenda conturi care încalcă acești termeni.
        </p>

        <h2 className="mt-6 text-base font-semibold">8. Limitarea răspunderii</h2>
        <p className="mt-2 text-foreground/85">
          Ventuza nu verifică identitatea reală a utilizatorilor dincolo de moderarea fotografiilor și verificarea selfie
          opțională. Întâlnirile fizice au loc pe propria răspundere. Recomandăm folosirea practicilor de siguranță (loc
          public, prieten informat, transport propriu) și a prevenției medicale (testare periodică, PrEP).
        </p>

        <h2 className="mt-6 text-base font-semibold">9. Modificări</h2>
        <p className="mt-2 text-foreground/85">
          Putem actualiza acești termeni. Te vom anunța prin notificare în aplicație cu cel puțin 14 zile înainte de
          aplicarea modificărilor majore.
        </p>

        <h2 className="mt-6 text-base font-semibold">10. Lege aplicabilă</h2>
        <p className="mt-2 text-foreground/85">
          Acest acord este guvernat de legea română și legislația UE aplicabilă. Litigiile se soluționează în instanțele
          competente din România.
        </p>

        <h2 className="mt-6 text-base font-semibold">11. Contact</h2>
        <p className="mt-2 text-foreground/85">
          Întrebări: <a className="text-primary" href="mailto:support@ventuza.app">support@ventuza.app</a>
        </p>
      </article>
    </div>
  );
}
