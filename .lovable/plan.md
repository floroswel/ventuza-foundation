# Raport audit Ventuza — pregătire Google Play

Legendă: 🔴 blocker / 🟡 major / 🟢 minor · **[NATIV]** = necesită folder `android/` (nu există) · **[WEB]** = se poate corecta acum

Notă: folderul `android/` **NU există** în repo (`ls android` → not found). Tot ce ține de `AndroidManifest.xml`, `res/values/styles.xml`, `strings.xml`, `assetlinks.json`, permisiuni runtime declarate, deep-link intent-filter, temă splash, adaptive icons, versionCode → se rezolvă doar după `npx cap add android` (sau prin CI-ul `android-release`).

---

## A. Web vs Nativ (cookie banner & aromă „website")

| # | Fișier | Sev | Problemă | Ce ar trebui |
|---|---|---|---|---|
| A1 | `src/components/CookieBanner.tsx` | 🟢 | Deja are guard `Capacitor.isNativePlatform()` → nu apare pe nativ. **Merge corect.** Confirmare că mecanismul GDPR (`ConsentPromptHost`, `Settings → Consimțăminte`) rămâne canalul unic pe nativ. | Niciun fix necesar. Doar validat la build. |
| A2 | `src/routes/__root.tsx` | 🟡 | `<CookieBanner />` montat la root — pe web e OK, pe nativ e mort (guard-ul din component). Ordinea/prezența nu deranjează, dar oricine curăță „componente nefolosite" poate fi tentat să-l scoată. | Comentariu în root că e intenționat + eventual mount condiționat. |
| A3 | `src/components/OfflineBanner.tsx` | 🟢 | Banner „No internet" cu look de web toolbar; pe nativ Capacitor are Network plugin dedicat cu UI mai natural. | Păstrat, doar de stilizat pt. mobil. |
| A4 | `src/routes/__root.tsx` (`<TravelWarning>`, `<LocationPermissionPrompt>`, `<VersionGate>`, `<AgeGate>`) | 🟢 | Multe overlay-uri suprapuse la boot; pe device mic pot bloca vizual auth-ul. | Prioritizat/ordonat vizual. |
| A5 | scroll + selecție text | 🟡 [WEB] | În `src/styles.css` lipsește `overscroll-behavior: none`, `-webkit-tap-highlight-color: transparent`, `user-select: none` pe UI chrome (rămâne text-select nativ browser peste titluri, butoane). | Adăugat la `body`/`button` în `styles.css`. |

---

## B. Android Native UX

| # | Fișier | Sev | Problemă | Ce ar trebui |
|---|---|---|---|---|
| B1 | `src/styles.css` (linii 105-325) + `src/routes/__root.tsx` viewport | 🟢 | Safe-area declarat pe `body` + clase utility. `viewport-fit=cover` prezent. **OK conceptual.** | Verificat pe device că nu dublează padding-ul (top se aplică și pe body și pe headere). |
| B2 | `src/components/BottomNav.tsx` | 🟡 [WEB] | Trebuie confirmat că folosește `pb-[env(safe-area-inset-bottom)]`; pe telefoanele cu gesture bar poate suprapune butonul home. | Audit vizual + `padding-bottom: env(safe-area-inset-bottom)`. |
| B3 | `capacitor.config.ts` | 🟡 | `StatusBar { style: DARK, backgroundColor: #0B0B0F }`. Pe Android 15+ (edge-to-edge forțat), `backgroundColor` este ignorat → status bar poate deveni transparent peste conținut. | La build nativ setat `overlay: false` explicit sau folosit `StatusBar.setOverlaysWebView({ overlay: false })` la boot. |
| B4 | Keyboard | 🔴 [NATIV] | Nu există `@capacitor/keyboard` în `package.json`. Fără el, input-urile din chat/auth pot fi acoperite de tastatură pe Android. | Adăugat plugin + `Keyboard.setResizeMode({ mode: 'native' })` + `windowSoftInputMode=adjustResize` în manifest. |
| B5 | Splash screen | 🟢 | Config prezent în `capacitor.config.ts` (1200ms, `#0B0B0F`, resource `splash`). | La build nativ trebuie generate resurse `android/app/src/main/res/drawable*/splash.png`. |
| B6 | `src/components/BackButton.tsx` | 🟡 [NATIV parțial] | Există componentă vizuală, dar nu văd `App.addListener('backButton', ...)` la nivel root. Pe Android butonul hardware Back va închide app-ul în loc să navigheze înapoi. | Handler global în root layout care apelează `router.history.back()` sau `App.exitApp()` la ruta rădăcină. |
| B7 | Haptic feedback | 🟢 | Nu e instalat `@capacitor/haptics`. Micro-feedback lipsă la swipe/match. | Opțional post-launch. |
| B8 | `PrivacyScreen` plugin | 🟢 | Configurat (`preventScreenshots: true`). OK. |  |

---

## C. Auth Google (DOAR raport — nu modificăm)

| # | Fișier | Sev | Problemă | Ce trebuie la nativ |
|---|---|---|---|---|
| C1 | `src/routes/auth.tsx` | 🔴 | Butoanele Google/Apple **au fost eliminate** în ultima iterație. Login-ul curent este **doar email + parolă**. `@capgo/capacitor-social-login` rămâne instalat dar nefolosit. | Pentru reactivarea Google nativ: reintegrat `src/lib/native-google-auth.ts`, `VITE_GOOGLE_WEB_CLIENT_ID` (env), configurat SHA-1/SHA-256 în Google Cloud Console pentru `com.ventuza.dating`, tip client „Android" + „Web application" (audience id_token), redirect URI în Supabase Auth. |
| C2 | `src/lib/native-google-auth.ts` | 🟡 | Fișier orfan după eliminarea butoanelor — cod mort care importă `@capgo/capacitor-social-login`, crește bundle-ul web inutil (import dinamic, deci impact real minim). | La reactivare, refolosit. Până atunci: candidat curățare (dar **nu șterge acum**). |
| C3 | Fluxul web OAuth (`lovable.auth.signInWithOAuth`) | 🔴 [dacă ar fi reactivat] | Într-un WebView Capacitor, Google returnează 404 din 2021. **Nu se poate folosi flux web pe nativ** — obligatoriu `signInWithIdToken`. | La reactivare, guard strict pe `Capacitor.isNativePlatform()`. |

**Recomandare:** nu reactivăm Google până când nu avem un build Android testabil. Riscul de a bloca login-ul este real.

---

## D. Reset parolă / Deep links

| # | Fișier | Sev | Problemă | Ce lipsește |
|---|---|---|---|---|
| D1 | `src/routes/auth.tsx` `onForgotPassword` | 🟡 | `redirectTo: ${window.location.origin}/reset-password`. Pe app nativ `window.location.origin` = `https://localhost` sau `capacitor://localhost` → linkul din email va deschide browser web, nu app-ul. | Deep link cu schema custom `ventuza://reset-password` SAU App Link `https://ventuza.app/reset-password` cu `assetlinks.json` publicat. Config în server Auth Supabase și în `AndroidManifest.xml` intent-filter. **[NATIV]** |
| D2 | `src/routes/reset-password.tsx` | 🟡 | Ruta există (web), dar nu am validat că parsează corect token din fragment `#access_token=...` când e deschisă direct din email. | Validat manual pe device. |
| D3 | Email de confirmare signup (`emailRedirectTo: ${origin}/n`) | 🟡 | Aceeași problemă ca D1 — link email nu se deschide în app pe nativ. | Deep link. **[NATIV]** |
| D4 | `assetlinks.json` | 🔴 [NATIV] | Nu există `public/.well-known/assetlinks.json`. Fără el, App Links nu se validează → link-ul deschide browser. | Generat cu SHA-256 al certificatului semnat + `package_name=com.ventuza.dating`. |

---

## E. Responsive

| # | Fișier | Sev | Problemă |
|---|---|---|---|
| E1 | `src/routes/discover.tsx` (1850 LOC) | 🟡 | Fișier uriaș, greu de auditat vizual. Probabil are edge-cases pe ecrane <360px. |
| E2 | `src/routes/messages.$id.tsx` | 🟡 | Chat + composer + safe-area + tastatură = zona clasică de bug. Fără plugin Keyboard (vezi B4), composer-ul e acoperit pe Android. |
| E3 | `src/routes/nearby.tsx` (453 LOC) + hartă | 🟡 | Hărțile în WebView cer touch handling explicit + `touch-action: none` pe container. |
| E4 | Landscape | 🟢 | `manifest.webmanifest` are `orientation: portrait`; în manifest Android trebuie replicat `android:screenOrientation="portrait"` altfel apar rotații neintenționate. **[NATIV]** |
| E5 | Butoane <44×44px | 🟡 | În `CookieBanner`, `auth.tsx` (buton „show password"), `BottomNav` iconițe — de verificat cu regula 48dp Google. |

---

## F. Performanță

| # | Fișier | Sev | Problemă |
|---|---|---|---|
| F1 | `src/routes/discover.tsx` 1850 LOC | 🟡 | Grila probabil nevirtualizată (nu apare `react-window`/`virtuoso` pe discover). Sute de carduri = jank. |
| F2 | Imagini `<img>` fără `loading="lazy"` | 🟡 | `rg` arată multe `<img>` fără atributul lazy. |
| F3 | `SmartImage` / `ProtectedImage` | 🟢 | Există wrappers — de verificat că fac lazy + srcset. |
| F4 | Bundle | 🟡 | 100+ componente admin importate — de verificat că `/admin` e cod-splittat lazy (nu e în bundle-ul user). |
| F5 | `VirtualizedMessages` | 🟢 | Există pentru chat — bine. |

---

## G. Permisiuni Android

| # | Loc | Sev | Problemă |
|---|---|---|---|
| G1 | `useLocationWatcher.ts` + `SosCard`, `nearby.tsx` | 🟡 | Folosesc `navigator.geolocation` web. Pe Capacitor Android trebuie `@capacitor/geolocation` (nu e instalat) pentru permission dialog nativ + acces în background. |
| G2 | `ChatComposerExtras.tsx` | 🟡 | Cameră/foto/microfon via `getUserMedia` — pe Android WebView cere `<uses-permission>` explicit + runtime request. **[NATIV]** |
| G3 | `native-push.ts` POST_NOTIFICATIONS | 🟢 | Documentat corect că cere runtime pe Android 13+. |
| G4 | `ACCESS_BACKGROUND_LOCATION` | 🔴 [NATIV] | Regula de proximity spune că geofencing background necesită consimțământ + permisiune specială Play. Dacă manifestul o declară fără justificare, Play respinge app-ul. Confirmat că nu se cere. |

---

## H. Google Play Compliance

| # | Loc | Sev | Problemă |
|---|---|---|---|
| H1 | Data safety form | 🟡 | `/legal/data-safety` pare completat, dar trebuie mapat 1:1 cu Play Console Data Safety (secțiuni: colectat/opțional, tip date, scop). |
| H2 | Age rating | 🔴 | App 18+ NSFW → cere IARC „Adult 18+" + declarare conținut sexual. Dacă e greșit clasificat = respingere. |
| H3 | `AndroidManifest.xml` `usesCleartextTraffic` | 🟢 | `capacitor.config` are `allowMixedContent: false`. OK. |
| H4 | `versionCode` / `versionName` | 🟢 | Bump la 2 / 1.0.1 e vizibil în `release/version.json`. |
| H5 | Google Sign-In eliminat | 🟡 | Store Listing / screenshots — dacă apar butoane Google în capturi, refresh screenshots. |
| H6 | Politica de conținut LGBTQ+ NSFW | 🟡 | Play permite, dar cere filtru „mature content". A se verifica flag-ul `Contains ads` + `In-app purchases`. |
| H7 | ANR risk | 🟡 | Multe query-uri Supabase la boot (`__root.tsx` are 7-8 providers). Pe device slab poate depăși 5s → ANR. |

---

## I. Curățenie (candidați — NU șterge acum)

| Fișier | De ce candidat |
|---|---|
| `src/lib/native-google-auth.ts` | Import-uri neapelate după eliminarea Google auth. |
| `@capgo/capacitor-social-login` în `package.json` | Dependency instalat, neapelat. |
| `src/routes/onboarding.tsx` | Doar redirect la `/n` — poate fi înlocuit cu redirect în router. |
| `src/routes/gallery-test.tsx` | Rută de test în producție. 🟡 |
| `src/components/DebugPanel.tsx` | Montat în root; verifică gate-ul de prod. 🟡 |
| Console warnings | Nu am pornit preview pentru snapshot; recomand rulare separată. |

---

## TOP 10 impact real (ordonat)

1. 🔴 **B4 — lipsă `@capacitor/keyboard`** → tastatura acoperă input-urile în auth/chat. Blocker UX Play.
2. 🔴 **D1 + D4 — deep links reset password + assetlinks.json** → link-ul din email deschide browser, userul rămâne fără parolă. Blocker suport.
3. 🔴 **I/gallery-test + DebugPanel în prod** → risc respingere Play pentru „rute de test expuse". Verificat gate.
4. 🔴 **H2 — age rating IARC 18+** → configurat corect în Play Console înainte de upload.
5. 🟡 **B6 — back button Android nehandled** → app iese la primul back. UX Android non-negociabil.
6. 🟡 **G1 + G2 — geolocație + cameră/microfon fără plugin nativ** → dialoguri de permisiune inconsistente, unele funcții tăcut eșuate.
7. 🟡 **C1 — Google auth dezactivat** → users existenți care s-au înregistrat cu Google **nu se mai pot loga**. Necesită comunicare + reset password sau reactivare.
8. 🟡 **F1 — discover.tsx nevirtualizat** → jank sever pe telefoane mid-range.
9. 🟡 **B3 — StatusBar edge-to-edge Android 15** → conținut sub status bar. Vizual + a11y.
10. 🟡 **H7 — ANR la boot** din providers multipli + Supabase queries paralele → crash-loop la lansare pe device slab.

---

## Recomandare pentru bucățile următoare

Ordine sugerată de reparat, fiecare bucată separată (voi cere confirmare la fiecare pas):
- **B1** — Keyboard plugin + safe-area BottomNav (WEB + capacitor config)
- **B2** — Back button handler global (WEB, se activează când există android/)
- **B3** — Deep links + reset password (WEB config + `.well-known/assetlinks.json`)
- **B4** — Curățenie cod mort (Google auth orfan, rute test, DebugPanel gate)
- **B5** — Performanță discover (virtualizare + lazy images)
- **B6** — Permisiuni: switch la `@capacitor/geolocation` cu fallback web
- **B7** — Decizie Google auth: reactivare nativă sau comunicare useri
- **B8** — Generare folder `android/` (`npx cap add android`) + configurare manifest, permisiuni minime, splash, adaptive icons, intent-filter deep link

Aștept confirmarea ta pentru bucata #1 (Keyboard + BottomNav safe-area) sau altă ordine.
