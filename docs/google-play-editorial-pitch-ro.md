# Suzeta — dosar de nominalizare editorială pentru Google Play

Contact: contact@suzeta.ro · DPO: dpo@suzeta.ro
Pachet: `app.suzeta` · Site: https://www.suzeta.app
Categorie: Dating · Clasificare: 18+ · Țara de origine: România

---

## 1. Într-un paragraf

Suzeta este o aplicație de dating, prietenii și evenimente pentru comunitatea
LGBTQ+ din România, făcută în România, în română și engleză. A apărut pentru că
aplicațiile folosite azi de comunitate au fost gândite altundeva, pentru
altcineva, și pun exact funcțiile de siguranță după paywall. La Suzeta toate
sunt gratuite: mesaje nelimitate, like-urile primite, boost, travel mode,
verificare, asistent AI. Aplicația se susține din parteneriate cu locuri și
branduri LGBTQ-friendly, nu din abonamente, nu din rețele de reclame și
niciodată din vânzarea datelor.

## 2. De ce merită atenție

România rămâne unul dintre locurile mai grele din Uniunea Europeană în care
poți fi deschis queer. Un outing involuntar poate costa un job, o familie, o
locuință. Faptul acesta a modelat fiecare decizie de produs:

- **Locația exactă nu pleacă niciodată de pe telefon.** Distanțele arătate
  altor utilizatori sunt bucketizate ("sub 1 km", "1 la 5 km"). Notificările
  de proximitate pentru locuri și evenimente se calculează pe dispozitiv. Nu
  se stochează istoric de poziții nicăieri.
- **Anti-outing este un set de funcții, nu o bifă.** Mod incognito, album
  privat cu deblocare unu-la-unu, comportament discret al aplicației,
  protecție la screenshot și control fin peste ce vede fiecare.
- **Instrumente de siguranță la un tap.** Buton de panică cu apel 112 și
  trimiterea locației către contacte de încredere, apel fals ca să poți pleca
  dintr-o situație proastă, ieșire rapidă, blocare cu PIN și biometrie,
  avertizare de risc când cineva călătorește într-o țară mai puțin sigură.
- **Datele din categorii speciale sunt tratate ca atare.** Informația
  opțională de sănătate este cifrată la nivel de coloană și se poate scrie
  doar după consimțământ explicit înregistrat. Retragerea consimțământului
  șterge datele în aceeași tranzacție.

## 3. Ce este nou aici

1. **Dating fără paywall, dar cu model de business.** Tot ce se vinde de obicei
   ca Premium este gratuit pentru toți. Veniturile vin din portalul B2B, unde
   baruri, cluburi, cabinete și organizatori de evenimente plătesc pentru
   listare și promovare. Facturarea se face prin transfer bancar, cu confirmare
   manuală, deci nu există procesator de plăți care să atingă date de useri.
2. **Moderare umană înainte de publicare, nu după reclamații.** Niciun venue,
   eveniment sau ofertă nu devine vizibil până când un moderator îl aprobă.
   Aprobarea este o singură acțiune server-side auditată; partenerul nu se poate
   auto-publica, iar regula este impusă în bază de date.
3. **Verificare fără colectare de act de identitate.** Vârsta se verifică prin
   selfie live trimis unui procesator din UE care estimează vârsta și șterge
   imaginea imediat. Nu cerem, nu primim și nu stocăm documente.
4. **Un strat de comunitate, nu doar o grilă.** Hartă cu locuri friendly
   verificate manual, calendar de evenimente construit în jurul Pride,
   party-urilor, workshop-urilor și meetup-urilor, plus un program de
   ambasadori care răsplătește oamenii care aduc prieteni în aplicație.

## 4. Aliniere cu politicile de siguranță

- **Exclusiv 18+, impus tehnic.** Verificarea de vârstă este obligatorie în
  producție și nu poate fi oprită din configurare. Funcțiile sociale sunt
  blocate la nivel de bază de date, nu doar ascunse în interfață.
- **Siguranța copiilor.** Toleranță zero pentru CSAM. Materialul suspectat nu
  este randat niciodată în produs, nici pentru staff; se lucrează pe hash și se
  escaladează la autorități. Pagini publice:
  https://www.suzeta.app/child-safety și
  https://www.suzeta.app/legal/age-policy
- **DSA.** Punct unic de contact, flux de raportare conform Art. 16 și apel
  transparent conform Art. 20: https://www.suzeta.app/legal/dsa
- **GDPR.** DPO desemnat, listă publică de subprocesatori, registru Art. 30
  intern, export de date Art. 20 și ștergere completă de cont.
  https://www.suzeta.app/legal/privacy ·
  https://www.suzeta.app/legal/subprocessors
- **Fără advertising ID.** Permisiunea `AD_ID` este eliminată explicit din
  manifestul final. Fără AdMob, fără tracking între aplicații, fără brokeri.
- **Fără permisiune de locație în background.** Proximitatea funcționează fără ea.
- **Anti-abuz.** Protecție anti-bot pe toate formularele de autentificare,
  fingerprinting de dispozitiv, limite de rată impuse în baza de date și
  blocare bilaterală aplicată de un trigger, nu de client.

## 5. Semnale de calitate tehnică

- Build Android nativ cu edge-to-edge pentru Android 15 și mai nou, la nivelul
  de API cerut curent de Play.
- `FLAG_SECURE` împotriva capturilor și înregistrării de ecran pe ecranele
  sensibile, setări WebView întărite, certificate pinning în configurația de
  rețea, verificări de root și integritate.
- Suport offline, caching persistent, compresie de imagini la upload, lazy
  loading și code splitting, cu skeleton-uri pe primul ecran în loc de spinnere.
- Localizare completă română și engleză.

## 6. Ce cerem

Luarea în considerare pentru plasare editorială în categoriile Dating și Social
și pentru orice colecție Google Play care evidențiază produse safety-first,
aplicații construite local sau aplicații care servesc comunități
subreprezentate din Europa Centrală și de Est.

La cerere putem oferi un cont de reviewer pre-verificat, un tur demo, DPIA-ul
și planul de răspuns la incidente.

## 7. Kit de presă

- Listare: https://play.google.com/store/apps/details?id=app.suzeta
- Site: https://www.suzeta.app
- Feature graphic și icon: `store-assets/`
- Screenshots: `store-assets/README.md`
- Termeni: https://www.suzeta.app/legal/terms
- Reguli de comunitate: https://www.suzeta.app/community-guidelines
- Centru de siguranță: https://www.suzeta.app/safety
