
# Raport: detecție producție (isProductionHost) — stare actuală

## 1. Unde e definită logica

**Singur loc:** `src/lib/age-gate-policy.ts`, funcția `isProductionHost(hostname)`.
Nu există mirror server-side (comentariul din fișier zice "oglindită pe server în `requireAgeGateEnforcement`", dar în `src/lib/age-verification.functions.ts` nu există o astfel de funcție — gardul e doar client-side).

Logică actuală (allow-list de NON-prod, restul = prod):
- `localhost`, `127.0.0.1`, `*.local` → NON-prod
- `id-preview--*` → NON-prod
- `*-dev.lovable.app`, `*--dev.lovable.app` → NON-prod
- `*.lovableproject.com` → NON-prod
- `*.lovable.dev` → NON-prod
- **orice altceva → PROD** (inclusiv custom domains și `*.lovable.app` publicat)

SSR / hostname gol → `true` (fail-safe prod).

## 2. ventuza.eu recunoscut ca producție?

**DA.** Atât `ventuza.eu` cât și `www.ventuza.eu` nu se potrivesc cu niciun pattern din allow-list-ul de NON-prod, deci cad pe ramura default `return true`. La fel `ventuza-foundation.lovable.app` (publicat).

## 3. Ce depinde de flag

a) **Age verification forțat ON** — ⚠️ PARȚIAL. `shouldEnforceAgeGate()` are momentan **kill-switch activ** (comentat explicit în cod): override-ul hard `if (isProductionHost()) return true;` este **DEZACTIVAT**. Acum, și în producție, enforcement-ul respectă `feature_flags.age_verification.enabled` (fail-safe ON dacă flag-ul lipsește / eroare). Deci pe `ventuza.eu`, age gate este ON **doar dacă** flag-ul din DB e ON sau lipsă/eroare. Dacă cineva îl pune OFF, e OFF și în prod. Asta contrazice REGULA — AGE GATE din AGENTS.md.

b) **Demo seed banner roșu** (`DemoSeedBanner`) — afișat doar dacă `isProductionHost() === true` ȘI există seed. Pe `ventuza.eu` → DA, va apărea avertizarea când există conținut `is_seed`.

c) **Simulator locație** (`DemoSeedPanel` → secțiunea simulează locația) — ascuns/dezactivat dacă `isProductionHost() === true`. Pe `ventuza.eu` → DA, ascuns.

d) **Bannere de dev** — în `admin.tsx` se afișează `isProductionHost: true/false` ca text de diagnostic. Nu există alt banner "DEV" condiționat aici. `AgeGate.tsx` are doar un `console.warn` când enforcement-ul e OFF.

e) **Altele:** nimic altceva nu depinde de `isProductionHost`. RPC-uri server, RLS, triggere health/locație, moderare, billing — toate independente de flag. Seed demo (`seedDemoContent`) este gated pe `super_admin`, NU pe `isProductionHost` (poate rula în prod dacă super_admin apasă butonul).

## 4. Ce se întâmplă când ventuza.eu devine live

Pentru că `ventuza.eu` **ESTE** deja recunoscut ca prod:
- Age verification: depinde **strict** de `feature_flags.age_verification` din DB (din cauza kill-switch-ului). Dacă flag-ul e ON sau lipsește → enforcement ON. Dacă e OFF în DB → **OFF și în prod**. ⚠️ Acesta e singurul risc real de conformitate.
- Demo seed banner roșu: va apărea când există date `is_seed`.
- Simulator locație: ascuns.

## 5. capacitor.config.ts

Folosește două moduri:
- `CAPACITOR_DEV=1` → server.url către preview Lovable (`https://31f90140-…lovableproject.com`) pentru hot-reload pe device.
- Mod prod (default) → încarcă din `dist/` local (bundle împachetat). NU referă `ventuza.eu`, ceea ce e **corect** pentru un APK Google Play (webview citește asset-urile native, nu un domeniu remote).

Nu trebuie schimbat pentru lansare pe `ventuza.eu`. Singura atenție: build-ul de prod (`bun run build && npx cap sync`) trebuie făcut cu env-uri Lovable Cloud reale (deja sunt în `.env`), nu cu CAPACITOR_DEV.

---

## Recomandare (de aplicat după aprobare)

Pentru a respecta REGULA — AGE GATE din AGENTS.md ("Producție → întoarce `true` necondiționat, IGNORĂ flag-ul"):

1. **Re-introdu hard override-ul** la începutul `shouldEnforceAgeGate()` în `src/lib/age-gate-policy.ts`:
   ```ts
   if (isProductionHost()) return true;
   ```
   Imediat după declarația funcției, înainte de cache check. Asta restaurează comportamentul documentat: în prod (`ventuza.eu`, `www.ventuza.eu`, `ventuza-foundation.lovable.app`, custom domain) age gate-ul e ON indiferent de flag.

2. **Actualizează comentariul** din header-ul fișierului ca să reflecte că kill-switch-ul a fost dezactivat.

3. **Adăugă explicit `ventuza.eu`** ca prod test în comentariile funcției `isProductionHost` (cosmetic — logica funcționează deja).

4. **Opțional (recomandat):** mirror server-side în `startAgeVerification` care verifică `Origin`/`Referer` și refuză să creeze sesiune Didit dacă vine de la host non-prod cu flag OFF — eliminăm dependența pur client-side.

Nimic altceva nu trebuie schimbat pentru `ventuza.eu`. Capacitor și restul guardurilor sunt OK.

Aprobi să aplic recomandările 1–3 (re-activare hard override + curățare comentarii)? Punctul 4 (mirror server-side) îl propun separat dacă vrei și acel strat de apărare.
