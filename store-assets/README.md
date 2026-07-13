# Store Assets — Ventuza (Google Play)

Assets pentru Play Console. Toate imaginile aici sunt pentru submisia oficială,
nu pentru bundle-ul aplicației.

## Feature Graphic

- **feature-graphic.png** — 1024×500 PNG, obligatoriu pentru toate listing-urile.
  Fără text mărunt (Play îl comprimă), safe pentru dating 18+, fără conținut
  explicit. Branding: wordmark Ventuza + tagline "Dating, elevated." + logo
  heart (crescents auriu/rose pe fundal amber/purple).

## App Icon (deja livrat separat)

- 512×512 PNG cu transparență → generat din `public/icon-512.png`.
- Trebuie să corespundă cu icon-ul adaptiv Android (foreground + background +
  monochrome — vezi `android-overrides/res/`).

## Screenshots (de capturat din emulator/device)

Play cere:
- **Phone**: minim 2, max 8. Rezoluție 1080×1920 (portrait) recomandat.
- **7" tablet**: opțional dar recomandat pentru vizibilitate — 1200×1920.
- **10" tablet**: opțional — 1600×2560.

Ecrane recomandate de capturat (în ordinea de impact):

1. **Feed Discover** — 3-4 profile vizibile, badge-uri active, distanță
   bucketizată. Cel mai important — asta cumpără userul.
2. **Chat 1:1** — conversație cu reply, reaction, timestamp. Arată realism
   fără să expună date personale.
3. **Match modal** — moment emotional, "It's a match!" cu foto ambelor părți.
4. **Nearby / Hartă** — heat-map / venues aproape, arată dimensiunea "hangout".
5. **Profil owner** — completat cu prompts, photos, badges — inspiră "asta pot
   avea".
6. **Safety / Panic tools** — SOS card, fake call, blocking. Diferentiator
   pentru dating LGBTQ+ (Play apreciază safety-first).
7. **Verify (Didit selfie preview)** — arată că e app serios, 18+ verificat.
8. **Onboarding step 1** — pronouns, tribes, orientation → semnal queer-first
   fără a fi explicit.

**Reguli**:
- Fără status bar cu ora nerealistă (setează 9:41 sau ora curentă).
- Fără notificări în bara de sus.
- Fără date reale de useri — folosește conturi demo (`is_seed=true`).
- Fără text overlay promotional cu font ilizibil (Play respinge).
- Dark mode preferat pentru consistență cu identitatea brandului.

## Variante testate

- `feature-graphic.png` — versiunea principală, cea din exemplul de mai sus.

Dacă vrei alternative pentru A/B testing în Play Console (Store Listing
Experiments), generează 2-3 versiuni cu paletă diferită (ex. verde smarald +
gold, sau albastru profund + coral) și numește-le
`feature-graphic-variant-a.png`, `-variant-b.png`.

## App descrieri (există deja în Fastlane)

- `fastlane/metadata/android/en-US/full_description.txt` (max 4000 caractere)
- `fastlane/metadata/android/en-US/short_description.txt` (max 80 caractere)
- `fastlane/metadata/android/ro-RO/*.txt` — variantă românească

Fastlane le urcă automat la fiecare release. Verifică-le după fiecare
modificare majoră de feature-uri.
