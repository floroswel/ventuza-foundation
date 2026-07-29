# Play Console Submission Checklist — Suzeta

Checklist final de urcat prima versiune la Google Play (track: internal → alpha
→ production). Ordine identică cu meniul Play Console. Bifează pas cu pas.

---

## 1. App content → Privacy policy

- [ ] URL: `https://www.suzeta.app/legal/privacy`
- Verifică accesibil FĂRĂ login (test din incognito).

## 2. App content → Ads

- [ ] **Does your app contain ads? → No**
- **Justificare (nu se cere Play, dar documentat aici):** Suzeta nu difuzează
  ads third-party (Google Ads, AdMob, etc.). Sponsored banners in-app sunt
  conținut editorial B2B, nu ad network. Advertising ID (`AD_ID`) permission
  este REMOVED explicit din merged manifest (vezi `android-overrides/`).

## 3. App content → App access

- [ ] **All or some functionality restricted → Provide test credentials**
- Cont test dedicat pentru reviewer Play:
  - Email: `play-review@suzeta.eu` (creat pre-submisie)
  - Parola: (doar în submisie, nu în repo)
  - Instrucțiuni: "Login cu email/parolă. Age verification: reviewer poate cere
    override — contactează dev@suzeta.eu pentru cont pre-verificat."

## 4. App content → Content ratings (IARC)

Chestionar IARC standard. Răspunsuri recomandate pentru dating LGBTQ+ 18+:

| Întrebare | Răspuns |
|-----------|---------|
| Violence | None |
| Sexual content | **Mild sexual themes** (referiri la orientare, contact între adulți; NU explicit) |
| Language | Mild profanity may appear (UGC — moderat) |
| Controlled substances | No |
| Gambling | No |
| Simulated gambling | No |
| Location sharing | **Yes** (bucketized, nu exact) |
| Personal info sharing | **Yes** (profile UGC vizibil altor useri) |
| Digital purchases | No (schelet dormant — activ doar pentru B2B viitor) |
| User-generated content | **Yes** (profile, chat, photos) |
| User-to-user interaction | **Yes** (chat 1:1) |
| Unmoderated UGC | **No** — avem moderation queue + report/block + CSAM scan |

**Rezultat probabil:** IARC 18+ (Adults Only) pentru dating apps cu chat.

## 5. App content → Target audience and content

- [ ] **Target age groups**: 18 și peste (doar)
- [ ] **Does your app unintentionally appeal to children? → No**
- [ ] **Ads in app targeting children? → N/A** (no ads)

## 6. App content → News app

- [ ] **Is your app a news app? → No**

## 7. App content → COVID-19 contact tracing / status apps

- [ ] **Is your app a COVID-19 contact tracing or status app? → No**

## 8. App content → Data safety

- [ ] Copiază TOTUL din `docs/play-console-data-safety.md` în formular.
- [ ] "Does your app collect or share any of the required user data types?" → **Yes**
- [ ] "Is all of the user data collected by your app encrypted in transit?" → **Yes**
- [ ] "Do you provide a way for users to request that their data be deleted?" → **Yes**
- [ ] "Has your app been independently validated against a global security standard?" → **No**
- [ ] La "Advertising ID": **No**
- [ ] La "Independent security review": No (planificat Q4 2026)

## 9. App content → Government apps

- [ ] **Is your app a government app? → No**

## 10. App content → Financial features

- [ ] **Does your app provide financial features? → No**
  - Justificare: nu procesăm plăți card user. B2B partneri plătesc prin transfer
    bancar direct (OP), nu prin app. RevenueCat schelet dormant, nu activ.

## 11. App content → Health

- [ ] **Does your app collect health data? → Yes (Health info — HIV status opt-in)**
- Detalii:
  - Colectăm HIV status DOAR cu consimțământ explicit `health_data` (Art. 9 GDPR).
  - Cifrat la coloană (`pgp_sym_encrypt`).
  - User poate retrage consimțământ oricând → wipe automat.
  - Nu suntem app medicală. Nu oferim diagnostic / tratament.
  - Health Connect: NU integrat.

## 12. Store listing → App name / short description / full description

- [ ] Titlu: `Suzeta — Dating` (max 30 caractere)
- [ ] Short description: max 80 caractere — vezi
      `fastlane/metadata/android/en-US/short_description.txt`
- [ ] Full description: max 4000 caractere — vezi
      `fastlane/metadata/android/en-US/full_description.txt`
- [ ] Localizare RO: `fastlane/metadata/android/ro-RO/*.txt`

## 13. Store listing → Graphics

- [ ] Icon 512×512 PNG (transparent) — deja livrat.
- [ ] **Feature graphic 1024×500 PNG** — `store-assets/feature-graphic.png` ✅
- [ ] Screenshots phone (min 2, recomandat 8) — capture după `store-assets/README.md`.
- [ ] Screenshots tablet 7" (opțional, recomandat).
- [ ] Screenshots tablet 10" (opțional).
- [ ] Promo video YouTube URL (opțional).

## 14. Store listing → Categorization

- [ ] Category: **Dating**
- [ ] Tags: minim 1, max 5 (Play sugerează: dating, lgbt, chat, meet, social).

## 15. Store listing → Contact details

- [ ] Website: `https://www.suzeta.app`
- [ ] Email: `contact@suzeta.eu`
- [ ] Phone: opțional (recomandat gol dacă nu ai număr business dedicat).
- [ ] Privacy policy: `https://www.suzeta.app/legal/privacy`

## 16. App releases → Countries and regions

- [ ] Excluse: țări unde LGBTQ+ e criminalizat (list actualizată în DB
      `country_risk_config` cu `blocked=true`). Verifică sync manual:
      Rusia, Iran, Arabia Saudită, Uganda, Egipt, Nigeria, etc.
- [ ] Restul UE + US + CA + AU + NZ + UK + majoritatea LATAM: OK.

## 17. App releases → Internal testing → First upload

- [ ] AAB build via GitHub Actions (`Android Release` workflow).
- [ ] Adaugă cont test `play-review@suzeta.eu` la testeri interni.
- [ ] Rollout la 100% internal.
- [ ] Verifică review reviewer intern (Florin + max 5 useri de încredere) 3-7
      zile.

## 18. App releases → Production → First rollout

**Doar după 7+ zile stabil pe internal și după review consultant GDPR final.**

- [ ] Rollout gradual: 5% → 20% → 50% → 100% în 10-14 zile.
- [ ] Monitor Sentry / crash reports zilnic.
- [ ] Monitor Play Console → Vitals (ANR, crash rate < 0.5%).

---

## Acțiuni FIZIC imposibile fără Florin

Următoarele necesită conturile personale / plăți / semnături — dev nu le poate
face:

- [ ] Cont Google Play Console (25$ one-time).
- [ ] Cont Cloudflare Turnstile → creare site key + adăugare în GitHub Secrets
      (`VITE_TURNSTILE_SITE_KEY`) + secret key în Supabase Auth Dashboard.
- [ ] Supabase Auth Dashboard → configurare Turnstile secret + activare
      leaked password protection (HIBP).
- [ ] Google Cloud Console → OAuth Client Web (`VITE_GOOGLE_WEB_CLIENT_ID`) +
      SHA-1 fingerprint keystore-ului release.
- [ ] Firebase Console → creare proiect + descărcare `google-services.json`
      → upload ca `GOOGLE_SERVICES_JSON_BASE64` în GitHub Secrets.
- [ ] Didit dashboard → configurare API key + webhook secret.
- [ ] Cont Resend → domeniu verificat + DKIM/SPF pe `suzeta.app`.
- [ ] Cloudflare R2 → bucket privat pentru backup + rclone config.
- [ ] Semnătură DPIA + IR plan de către consultant GDPR extern.
- [ ] Publicare app: buton "Publish" în Lovable + submit Play Console.
