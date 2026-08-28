# Prompt de audit — Suzeta

Instrument de lucru pentru audit repetat pe cod. Nu e documentație: se copiază
și se rulează.

---

## Cum se folosește (citește asta, altfel nu funcționează)

Tentația e să ceri totul odată: „găsește toate bug-urile și vulnerabilitățile".
Un model căruia îi ceri 200 de verificări simultan le face pe toate superficial
și compensează inventând constatări care sună plauzibil. Rezultatul e o listă
lungă din care 80% e zgomot, iar bug-ul real e îngropat în ea.

Metoda care funcționează:

1. **O rulare = un domeniu.** Cele 14 domenii de mai jos se rulează separat, în
   sesiuni separate. Fiecare rulare are context curat și un scop îngust.
2. **Dovadă obligatorie.** Orice constatare fără `fișier:linie` și fără un
   scenariu concret de eșec se aruncă. Regula asta singură elimină majoritatea
   halucinațiilor.
3. **Repetă domeniile importante.** Securitatea bazei de date și
   confidențialitatea merită 3-4 rulări la distanță, cu formulări diferite.
   Rulările diferite găsesc lucruri diferite — asta e versiunea utilă a
   „10.000 de boți".
4. **Verifică fiecare constatare înainte să repari.** Cere reproducere. Un audit
   care raportează 40 de probleme din care 6 sunt reale e mai valoros decât unul
   cu 200 nefiltrate, dar doar dacă știi care 6.

Ordinea recomandată: **A, B, C, F** întâi — acolo stau riscurile care închid o
aplicație de dating. Apoi restul.

---

## PROMPTUL

Se copiază integral, se înlocuiește `{{DOMENIU}}` cu unul din blocurile de la
secțiunea următoare.

```
Ești auditor de securitate și fiabilitate. Faci un singur pass, îngust și
adânc, pe un cod de producție real: Suzeta, aplicație de dating cu utilizatori
reali, publicată în Google Play și pe suzeta.app.

STIVA
- Frontend: React 19 + TanStack Router/Start, TypeScript
- Mobil: Capacitor 8 (Android), WebView cu bundle local; apelurile /_serverFn
  și /api/ sunt rescrise cross-origin către https://suzeta.app
- Backend: server functions TanStack pe Cloudflare Workers + Supabase
  (Postgres, RLS, ~397 funcții SECURITY DEFINER, 112 tabele cu RLS,
  pg_net + pg_cron active)
- Auth: Supabase Auth, Google Sign-In nativ, verificare vârstă prin Didit
- Plăți: Google Play Billing prin RevenueCat
- Date sensibile: locație, fotografii, mesaje private, orientare, stare de
  sănătate, documente de identitate

DOMENIUL ACESTEI RULĂRI
{{DOMENIU}}

REGULI DE ANGAJAMENT — obligatorii

1. Citește codul înainte să afirmi ceva. Nu presupune ce face o funcție după
   nume. Dacă nu ai deschis fișierul, nu ai voie să-l comentezi.

2. Fiecare constatare are, obligatoriu:
   - cale/fisier.ts:linie
   - ce e greșit, în una-două propoziții
   - SCENARIU DE EȘEC concret: cine, ce face, ce obține. Nu „ar putea duce la
     expunerea datelor", ci „un utilizator autentificat apelează RPC-ul X cu
     _user_id-ul altcuiva și primește adresa lui exactă".
   - severitate: CRITIC / MARE / MEDIU / MIC
   - efortul reparării: minute / ore / zile

3. Dacă nu poți arăta linia, NU raporta. O listă scurtă și corectă bate una
   lungă și plauzibilă. Zero constatări e un rezultat valid și acceptabil.

4. Separă strict:
   - CONFIRMAT — am citit codul, se reproduce prin raționament pe cod
   - PROBABIL — arată greșit, dar depinde de ceva ce nu văd (config, date,
     secrete, stare din baza de date)
   - DE VERIFICAT MANUAL — nu se poate decide din cod; spune exact ce comandă
     sau ce interogare lămurește

5. Nu repara nimic. Nu propune diff-uri. Raportezi, atât. Reparațiile se fac
   separat, după ce sunt validate.

6. Nu raporta chestiuni de stil, formatare, denumiri sau preferințe de
   arhitectură. Doar lucruri care rănesc utilizatorul, expun date, pierd bani
   sau opresc aplicația.

7. Ordonează după risc real, nu după cât e de ușor de descris. Dacă găsești
   ceva CRITIC, pune-l primul și spune explicit de ce e critic.

FORMAT DE IEȘIRE

## Ce am acoperit
Fișierele și zonele citite efectiv. Fii onest — dacă n-ai apucat o zonă,
spune-o.

## Constatări
Ordonate după severitate. Formatul de la regula 2.

## Ce NU am putut verifica din cod
Cu ce ar fi nevoie ca să se lămurească.

## Ce lipsește complet
Lucruri care ar trebui să existe în acest domeniu și nu există deloc. Aici se
ascund cele mai scumpe omisiuni — nu în codul greșit, ci în codul absent.
```

---

## Cele 14 domenii

### A. Izolarea datelor în Postgres (RLS)

```
Politicile RLS și funcțiile SECURITY DEFINER. Sunt ~397 funcții SECURITY
DEFINER și 112 tabele cu RLS în supabase/migrations/. 16 politici folosesc
USING (true). 31 de funcții au GRANT EXECUTE către rolul anon.

Caută concret:
- funcții SECURITY DEFINER care primesc un user_id ca parametru și NU verifică
  auth.uid() înainte să-l folosească — un utilizator cere datele altuia
- funcții cu GRANT către anon care întorc date de profil, locație sau contact
- politici USING (true) pe tabele care conțin date personale
- SECURITY DEFINER fără SET search_path (deturnabil prin schema)
- tabele fără RLS deloc
- politici de UPDATE fără WITH CHECK (permit mutarea unui rând la alt owner)
- funcții care rulează cu drepturi de owner și întorc mai mult decât ar trebui
  apelantul să vadă
```

### B. Confidențialitate și fotografii

```
Fluxul de date personale: fotografii, locație, mesaje, orientare, sănătate,
documente de identitate.

Caută concret:
- bucket-uri de storage publice care ar trebui private
- URL-uri semnate cu durată prea lungă, sau semnate o dată și cache-uite
  indefinit (src/lib/signed-url-cache.ts, semnare la 3600s)
- precizia locației: se trimite coordonata exactă acolo unde ar trebui
  rotunjită? Se poate trilatera poziția exactă a cuiva din interogări repetate
  de distanță? (nearby_points, discover_profiles)
- date personale ajunse în URL-uri, query params, log-uri sau telemetrie
- modul discret / show_preview: există vreo cale prin care conținutul unui
  mesaj ajunge pe ecranul blocat când utilizatorul a cerut să nu ajungă?
- fotografii „o singură vizualizare": se pot recupera după vizualizare?
- ce rămâne pe device după logout sau ștergerea contului
- ce se întâmplă efectiv la ștergerea contului — chiar dispar mesajele,
  fotografiile și copiile din storage?
```

### C. Autentificare, sesiuni și verificarea vârstei

```
Supabase Auth, Google Sign-In nativ, AgeGate, Didit KYC, Turnstile.

Caută concret:
- căi prin care AgeGate poate fi ocolit (src/lib/age-gate-policy.ts are bypass
  pentru host-uri de dev — poate fi păcălit host-ul?)
- webhook-uri fără verificare de semnătură (Didit, Google Play RTDN,
  src/routes/api/public/)
- endpoint-uri publice fără rate limiting
- token-uri sau secrete ajunse în bundle-ul client (grep pe dist/client)
- sesiuni care nu expiră, sau refresh care nu invalidează vechiul token
- escaladare de privilegii: cum devine cineva admin? Se poate din client?
- ce se întâmplă cu sesiunea pe un telefon pierdut sau vândut
```

### D. Notificări push

```
Lanțul complet: declanșare → dispatch → FCM → device.

Context: push-ul de mesaj e declanșat de telefonul EXPEDITORULUI, nu de server.
Trigger-ul DB tg_notify_new_message scrie doar notificarea in-app.

Caută concret:
- toate căile prin care un mesaj poate exista fără ca push-ul să plece
- token-uri FCM rămase legate de utilizatorul greșit pe un device partajat
  (push_subscriptions: ce se întâmplă la logout și la re-login cu alt cont?)
- conținut de mesaj scurs în payload-ul push în ciuda show_preview=false
- notificări trimise unui utilizator blocat, raportat sau șters
- ore de liniște / master_push: se respectă pe TOATE căile de trimitere?
```

### E. Bani (Google Play Billing / RevenueCat)

```
Caută concret:
- validare de achiziție care se bazează pe ce spune clientul
- token de achiziție refolosibil (același token → mai multe conturi Premium)
- ce se întâmplă la refund, chargeback, anulare, expirare
- funcții Premium accesibile fără abonament activ, verificate doar în UI
- webhook RTDN: semnătură verificată? idempotent la livrare dublă?
- desincronizare între starea din RevenueCat și tabela subscriptions
```

### F. Siguranță și abuz — partea care contează cel mai mult

```
Aplicație de dating. Aici stau riscurile care închid o companie, nu bug-urile.

Caută concret:
- blocarea: un utilizator blocat mai poate vedea profilul, trimite mesaje, crea
  un cont nou și relua contactul? Blocarea e bidirecțională peste TOATE
  suprafețele (discover, mesaje, taps, likes, profil public, căutare)?
- raportarea: ajunge undeva unde chiar se citește? Există SLA?
- minori: ce oprește un cont de 15 ani în afară de o dată de naștere
  auto-declarată?
- CSAM: există detecție la încărcarea imaginilor? Cale de raportare?
- stalking: se poate deduce locația exactă sau programul cuiva?
- capturi de ecran în conversații (PrivacyScreen acoperă tot?)
- ce vede un utilizator șters — mai apare în conversațiile altora?
```

### G. Aplicația Android / Capacitor

```
Caută concret:
- lista de origini CORS din src/server.ts include https://localhost și
  http://localhost cu Allow-Credentials: true — poate fi exploatat de altă
  aplicație de pe același telefon sau de un server local?
- patch-ul de fetch din src/lib/native-api-origin.ts: poate fi redirecționat?
- deep links / App Links: o rută sensibilă poate fi deschisă de un link ostil?
  assetlinks.json corect?
- MainActivity.java expune SHA-1/SHA-256 și sursa instalării către WebView — ce
  mai poate citi JS-ul din contextul nativ?
- ce ajunge în APK și n-ar trebui (chei, endpoint-uri interne, cod de admin)
- WebView: navigare către origini externe permisă?
- ce se întâmplă offline, la reconectare, la pierderea sesiunii în fundal
```

### H. Integritatea mesajelor

```
Caută concret:
- mesaje pierdute la reconectare, la kill de proces, la trimitere offline
  (message-outbox)
- duplicare la retrimitere
- ordonare greșită la sosire simultană
- unsend / ștergere: chiar dispare la destinatar?
- mesaje livrate într-o conversație din care unul dintre participanți a fost
  blocat sau șters între timp
```

### I. Operare și incidente

```
Caută concret:
- CONFIRMAT deja: cron-ul Didit postează către vechiul domeniu Lovable, care
  răspunde 307 către suzeta.app. Header-ul Authorization se pierde la redirect
  cross-host, deci endpoint-ul întoarce 401. Verifică dacă mai există alte
  apeluri net.http_post către domenii care redirectează.
- secrete cu fallback tăcut: cod care merge mai departe fără să sesizeze nimeni
  când un secret lipsește (tiparul isFcmConfigured)
- ce se întâmplă când Supabase, Cloudflare sau FCM cad
- backup: există? A fost testată vreodată o restaurare?
- ce se loghează care n-ar trebui logat
- alertare: cine află, și în cât timp, că push-ul nu mai pleacă de 3 zile?
```

### J. Conformitate (GDPR / DSA / Google Play)

```
Caută concret:
- export de date și ștergere de cont: complete și funcționale?
- consimțământ: înregistrat, versionat, revocabil?
- Data Safety din Play Console corespunde cu ce face codul în realitate?
- politici Play pentru dating și conținut adult
- transferuri de date către procesatori nedeclarați în subprocessors
- retenție: există ceva care șterge automat datele vechi?
```

### K. Performanță pe telefon

```
Caută concret:
- apeluri de rețea care blochează primul render
- cascade secvențiale unde ar merge paralel
- N+1 pe listele de conversații și de profiluri
- imagini servite la rezoluție mai mare decât se afișează
- listeners, timere și subscripții realtime care nu se curăță
- ce se descarcă la pornire și nu e nevoie decât mai târziu
- cât JS se parsează înainte de primul pixel
```

### L. Rezistență la intrări ostile

```
Ia rolul atacatorului. Pentru fiecare endpoint și RPC:
- ce se întâmplă cu valori negative, zero, uriașe, null, string-uri de 10MB
- ce se întâmplă cu UUID-uri valide dar ale altcuiva
- ce se întâmplă cu apeluri concurente pe același rând (race pe credite, limite
  zilnice, taps, like-uri)
- limite server-side care există doar în UI
- paginare care poate fi forțată să întoarcă totul
```

### M. Ce nu există deloc

```
Nu căuta bug-uri. Caută absențe. Compară cu ce are orice aplicație matură de
dating și listează ce lipsește complet, cu impactul asupra utilizatorului sau al
afacerii. Fii nemilos și concret.

Zone: siguranța utilizatorului, moderare, suport, recuperare cont, observare,
testare, procedură de incident, antifraudă, accesibilitate, onboarding.
```

### N. Contradicții

```
Caută locuri unde codul se contrazice pe el însuși:
- o regulă aplicată într-un loc și uitată în altul
- două căi către aceeași acțiune, cu verificări diferite
- comentarii care descriu un comportament, cod care face altceva
- teste care afirmă o garanție pe care codul n-o mai oferă
- migrații care se anulează reciproc

Aici se ascund bug-urile de securitate care trec de review: nu cod greșit, ci
cod corect aplicat inconsecvent.
```

---

## Piste deja confirmate

Nu le mai căuta — sunt găsite. Servesc drept calibrare: cam așa arată o
constatare utilă.

| Ce | Unde | Stare |
| -- | ---- | ----- |
| Push-ul de mesaj depinde de telefonul expeditorului; dacă acesta blochează ecranul, notificarea nu mai pleacă | `src/lib/chat.ts` → `src/lib/push.functions.ts` | Redus (4 apeluri → 1), nerezolvat structural |
| Preflight CORS fără `Access-Control-Max-Age` — dublu RTT la aproape fiecare acțiune în aplicație | `src/server.ts` | Reparat |
| Loader-ul rădăcină cheamă un server fn ca să afle limba, inutil pe nativ | `src/routes/__root.tsx:161` | Deschis |
| Splash cu durată fixă 900ms; `SplashScreen.hide()` nu e apelat niciodată | `capacitor.config.ts` | Deschis |
| Cache-ul TanStack Query se restaurează după primul render, deci pornirea arată spinner în loc de conținut | `src/routes/__root.tsx:417` | Deschis |
| Rută care importă un export inexistent și face 500 pe tot server entry-ul în Node; blochează `build:mobile` local | `src/routes/lovable/email/auth/webhook.ts` | Deschis |
| Cron-ul de reconciliere Didit nu rulează: postează către vechiul domeniu Lovable, care redirectează 307 către suzeta.app, iar Authorization se pierde la redirect → 401 | `supabase/migrations/20260826220908_*.sql:250` | Confirmat |
| Repository-ul GitHub este **public**: tot codul de producție e vizibil oricui | `github.com/floroswel/ventuza-foundation` | Confirmat |
| `.env` este urmărit de git (doar chei publicabile, dar `.gitignore` nu îl conține deloc) | `.env` | Confirmat |
