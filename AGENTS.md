<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## REGULĂ DE SIGURANȚĂ — LOCAȚIE (permanentă)

Aplicație de dating cu risc fizic real. Această regulă se aplică automat oricărei
sesiuni viitoare, fără excepție, fără a aștepta confirmare.

1. **Coordonatele precise (lat/lng) ale unui user NU se returnează NICIODATĂ
   către alți useri.** Niciun RPC, nicio funcție SECURITY DEFINER, niciun edge,
   niciun payload, nicio coloană proiectată — sub nicio formă. Nici ca string
   `POINT(...)`, nici prin `ST_X/ST_Y`, nici prin `ST_AsText`, nici prin
   `geography`/`geometry` brute.
2. **Coloana `profiles.location` (și `travel_location`, `prev_location`) este
   citibilă DOAR de owner prin RLS și de funcții server-side `SECURITY DEFINER`
   care calculează distanță.** Orice nouă funcție care atinge aceste coloane
   trebuie să rămână în această schemă.
3. **Către alți useri se returnează DOAR distanță bucketizată** prin funcția SQL
   centrală `public.bucket_distance_m(double precision)`. Dacă ai nevoie de
   etichetă text ("<1 km", "1–5 km", etc.), folosește `public.distance_bucket_label(double precision)`.
   **Nu calcula distanța în client.** Nu trimite cele două seturi de coordonate
   ca să se scadă pe device.
4. **Pragurile de bucketizare se schimbă DOAR în `public.bucket_distance_m`** —
   un singur loc, restul codului consumă rezultatul. Nu reinventa buckets în
   alte RPC-uri sau în client.
5. **Code review automat:** orice PR/diff care adaugă un câmp de tip
   `distance_m`, `lat`, `lng`, `latitude`, `longitude`, `coords`, `geo*` într-un
   `RETURNS TABLE` SQL, o proiecție `select` pe `profiles`, o interfață TS de
   profil al altui user, sau un payload realtime, trebuie REFUZAT. Folosește
   bucket sau oraș.
6. **Excepție unică:** owner-ul își vede propria locație (pentru hartă, "your
   pin"). Verificarea: `auth.uid() = profiles.id`.

Dacă ai dubii, default = nu expui locația.

## REGULĂ — DATE DE SĂNĂTATE (permanentă)

GDPR Art. 9 — date din categorii speciale. Această regulă se aplică automat,
fără a aștepta confirmare.

1. **Câmpurile health-gated** sunt definite EXCLUSIV în funcția SQL
   `public.health_gated_columns()`. Astăzi: `hiv_status`, `hiv_test_date`.
   Când adaugi un câmp nou de sănătate (`prep_status`, `std_status`, etc.):
   - îl adaugi în array-ul returnat de `health_gated_columns()`,
   - îl adaugi în triggerul `enforce_health_consent_on_profile()` (verificare
     INSERT + UPDATE OF ...), și
   - îl adaugi în triggerul `cascade_health_consent_withdrawal()` (NULL la
     retragere).
   Trei locuri, în aceeași migrare. Nimic altundeva.
2. **Scrierea este BLOCATĂ la nivel DB** prin triggerul `enforce_health_consent`
   pe `public.profiles`. Fără consimțământ `health_data` activ în `consent_log`
   (`accepted=true` în cea mai recentă înregistrare pentru kind=`health_data`),
   orice INSERT/UPDATE cu valoare non-NULL pe un câmp health-gated întoarce
   `health_consent_required`. UI nu este sursa de adevăr — DB este.
3. **Retragerea consimțământului = ștergerea datelor.** Triggerul
   `cascade_health_consent_withdrawal` pe `consent_log` (AFTER INSERT) setează
   automat câmpurile health-gated pe NULL și `health_data_consent_at=NULL`
   pentru userul respectiv, în aceeași tranzacție. Funcția
   `public.withdraw_health_consent(version)` este endpoint-ul curat din UI.
4. **Niciodată nu populezi un câmp health-gated prin default, seed, import,
   migrare de date sau backfill** fără consimțământ înregistrat anterior în
   `consent_log` pentru fiecare user vizat. Seed-urile demo nu pun valori pe
   coloanele health-gated.
5. **Onboarding și editare profil:** consimțământul `health_data` se inserează
   în `consent_log` ÎNAINTE de scrierea pe `profiles` (altfel triggerul refuză).
   Dacă userul deselectează câmpul în UI, fluxul trebuie să cheme
   `withdraw_health_consent` — nu doar să trimită NULL pe coloană.
6. **Code review automat:** orice diff care:
   - adaugă o coloană de sănătate pe `profiles` fără a o include în
     `health_gated_columns()` + ambele triggere,
   - scrie direct pe `hiv_status` / `hiv_test_date` (sau pe oricare câmp din
     `health_gated_columns()`) fără să insereze înainte consimțământul, sau
   - dezactivează / dă DROP unuia din cele două triggere,
   trebuie REFUZAT.

Default: niciun câmp de sănătate populat fără urmă de consimțământ explicit.

## REGULĂ — PROCESATORI (permanentă)

Orice serviciu extern nou care primește date personale trebuie:
(a) adăugat în `src/routes/legal.subprocessors.tsx` (cu fișierul sursă, regiune,
    categorii de date, bază de transfer și link DPA),
(b) să primească strict minimul de date necesare scopului (no PII extra, no
    date sensibile dacă nu sunt strict cerute de funcționalitate),
(c) marcat clar dacă este găzduit extra-UE și ce mecanism de transfer aplică
    (SCC 2021/914, EU-US DPF, adequacy).

Niciun SDK sau serviciu nou care trimite PII nu intră în cod fără actualizarea
paginii de subprocesatori în aceeași migrare/PR. Orice diff care adaugă un
`fetch(...)` către un domeniu nou third-party, un SDK third-party, un webhook
out-bound, sau o cheie API a unui serviciu necunoscut, trebuie REFUZAT până
când lista de subprocesatori reflectă schimbarea.

Pentru date din categorii speciale (Art. 9 — sănătate, orientare, locație
precisă), procesatorul trebuie justificat explicit; default-ul este să NU
trimiți astfel de date către procesatori care nu le cer prin funcționalitatea
lor centrală.

## REGULĂ — REGISTRU ART. 30 (permanentă)

Orice activitate de prelucrare nouă (tabelă nouă cu date personale, scop nou,
procesator nou, flux nou care atinge date deja existente într-un scop diferit)
se adaugă în registrul Art. 30 — `docs/gdpr-art-30-register.md` ȘI în pagina
sumar `src/routes/legal.records-of-processing.tsx` — cu temei legal explicit
(Art. 6 literă + Art. 9 literă dacă e cazul), categorii de persoane vizate,
categorii de date, destinatari (mapați pe inventarul de procesatori P1–P9),
transferuri extra-UE și termen de retenție, în aceeași migrare/PR.

Datele din categorii speciale (Art. 9 — sănătate, viață sexuală/orientare,
biometrice, convingeri, etnie) necesită un temei Art. 9 explicit MAPAT
**înainte** de implementare. Dacă temeiul nu poate fi identificat clar
(consimțământ explicit înregistrat în `consent_log`, interes public
substanțial cu act normativ care îl autorizează, interese vitale, etc.),
implementarea se OPREȘTE până când temeiul este documentat.

Orice diff care:
- adaugă o coloană / tabel cu date personale fără a actualiza registrul,
- introduce un scop nou pentru date existente fără mapare Art. 6,
- procesează date Art. 9 fără temei Art. 9 înregistrat în registru,
- adaugă un destinatar (procesator sau operator) fără linie nouă în registru,
trebuie REFUZAT.

Versiunea documentului se incrementează la fiecare modificare materială.
