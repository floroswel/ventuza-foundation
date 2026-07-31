# Suzeta — Google Play Release Guide

Ghid complet pentru împachetarea și publicarea Suzeta pe Google Play.
Toate constrângerile de conținut și legale de mai jos sunt condiții
obligatorii pentru aprobare, nu recomandări.

## 1. Prereqs pe mașina de build (o singură dată)

- **Node 20 + Bun** (avem deja).
- **JDK 21** (Temurin) — Android Gradle Plugin 8.7 cere JDK ≥17; folosim 21.
- **Android Studio Ladybug (2024.2)+** — instalează SDK Platform 35 și
  Build-Tools 35.0.0.
- Variabile de mediu:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk   # macOS; ajustează pt Linux/WSL
  export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
  ```

## 2. Sincronizare Capacitor (după fiecare `bun run build`)

```bash
bun install
bun run build           # produce dist/
npx cap add android     # PRIMA DATĂ DOAR
npx cap sync android    # copiază dist/ + pluginii în android/
```

Config-ul relevant e în `capacitor.config.ts`:
- `appId = "app.suzeta"` (locked — nu schimba după prima urcare Play).
- `appName = "Suzeta"`.
- `webDir = "dist"`.
- `android.allowMixedContent = false` (obligatoriu Play).
- Plugin PrivacyScreen activ (blochează screenshots + task switcher).

## 3. Versionare (obligatoriu la fiecare release)

Editează `android/app/build.gradle`:

```gradle
android {
  defaultConfig {
    applicationId "app.suzeta"
    minSdkVersion 24            // Android 7.0 — cerință Play 2026 pentru dating
    targetSdkVersion 35          // Android 15 — cerință Play din august 2026
    versionCode 1                // INCREMENTĂ manual la fiecare urcare (număr întreg strict crescător)
    versionName "1.0.0"          // SemVer, vizibil userului
  }
}
```

Regula: `versionCode` NU se recalculează automat. La release fix (1.0.1) → +1.
La minor (1.1.0) → +10. La major (2.0.0) → +100. Sari niciodată înapoi.

## 4. Signing (keystore de release)

**Generează O SINGURĂ DATĂ**, salvează în seif (1Password / Bitwarden). Dacă
îl pierzi, nu mai poți urca update-uri sub același package.

```bash
keytool -genkey -v -keystore suzeta-release.keystore \
  -alias suzeta -keyalg RSA -keysize 4096 -validity 10000
```

Adaugă în `android/keystore.properties` (NU comita fișierul):
```
storeFile=../../suzeta-release.keystore
storePassword=***
keyAlias=suzeta
keyPassword=***
```

`android/app/build.gradle` (adaugă în `android { ... }`):
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
  keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
signingConfigs {
  release {
    storeFile file(keystoreProperties['storeFile'])
    storePassword keystoreProperties['storePassword']
    keyAlias keystoreProperties['keyAlias']
    keyPassword keystoreProperties['keyPassword']
  }
}
buildTypes {
  release {
    signingConfig signingConfigs.release
    minifyEnabled true
    shrinkResources true
    proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
  }
}
```

Adaugă în `.gitignore`:
```
android/keystore.properties
*.keystore
*.jks
```

## 5. Build AAB pentru Play

```bash
cd android
./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Test intern înainte de urcare:
```bash
./gradlew installRelease   # instalează pe device conectat prin USB
```

## 6. Google Play Console — Data safety form (OBLIGATORIU pentru dating)

Datele COLECTATE (declară în Play Console → App content → Data safety):

| Tip | Colectăm? | Împărtășim? | Efemer? | Scop |
|-----|-----------|-------------|---------|------|
| Nume / user name | Da | Nu | Nu | Cont & profil |
| Email | Da | Nu (doar procesator Supabase) | Nu | Cont & comunicare |
| Locație aproximativă | Da | Nu (bucketizat) | Nu | Discover / hartă |
| Locație precisă | Da | **Nu** — nu părăsește niciodată device-ul brut | Da (rotire regulată) | Calcul distanță pe server |
| Fotografii/media user | Da | Nu | Nu | Profil, mesaje, verificare |
| Contacte | Nu | — | — | — |
| Mesaje | Da | Nu | Nu | Chat |
| Info audio | Da (mesaje vocale) | Nu | Nu | Chat |
| Orientare sexuală | Da (opt-in) | Nu | Nu | Matching |
| Fotografii verificare (Didit) | Da (tranzient) | **Da → Didit** (procesator UE) | **Da** (Didit șterge imediat) | Verificare 18+ |
| Diagnostics / crash | Da | Nu | Nu | Stabilitate |
| ID device (FCM push token) | Da | **Da → Google FCM** (livrare push) | Nu | Notificări push native |

Practicile de securitate:
- ✅ Data encrypted in transit (HTTPS obligatoriu).
- ✅ Data can be deleted (Settings → Delete account).
- ✅ Follows Families Policy — nu (app 18+).
- ✅ Independent security review — nu încă.

## 7. Content rating

- **IARC → Adults 18+** (dating cu conținut adult).
- Motive: Sexual content — Suggestive, User Interaction — Users interact online,
  Personal information sharing.

## 8. App category & target audience

- Category: **Dating**.
- Target audience: **18+** exclusiv.
- Ads: **Nu**. (Sau Da cu declarare + AdMob dacă activezi ads).

## 9. Permisiuni Android declarate

Trebuie declarate în `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
<uses-permission android:name="com.google.android.c2dm.permission.RECEIVE"/>

<!-- NU cere ACCESS_BACKGROUND_LOCATION până când nu activezi geofencing real, -->
<!-- altfel Play cere Prominent Disclosure suplimentar + review manual. -->
```

## 10. Assets Play Store

- **Icon**: 512×512 PNG (deja generat).
- **Feature graphic**: 1024×500.
- **Screenshots**: minim 4, max 8 — 1080×1920 sau 1080×2340.
- **Short description**: max 80 chars, RO + EN.
- **Full description**: max 4000 chars, RO + EN, cu highlight 18+.

Sample short description:
> Suzeta — comunitate LGBTQ+ 18+ pentru întâlniri, prieteni, evenimente.

## 11. Legal — linkuri OBLIGATORII în Play listing

Setate în Play Console → App content:

- Privacy Policy: `https://suzeta.app/legal/privacy`
- Terms: `https://suzeta.app/legal/terms`
- Age policy: `https://suzeta.app/legal/age-policy`
- DMCA/DSA contact: `https://suzeta.app/legal/dsa`
- Community: `https://suzeta.app/legal/community`

Toate există în cod (`src/routes/legal.*`).

## 12. Sensitive App Access declarations

- **All files access**: NU folosim.
- **SMS/Call Log**: NU folosim.
- **Foreground services location**: NU (deocamdată; dacă activezi geofencing
  background trebuie declarat aici + demo video).
- **Health Connect**: NU — aplicația nu procesează date de sănătate.

## 13. Testing tracks

1. **Internal testing** (până la 100 tester emails) — pentru echipă, feedback rapid.
2. **Closed testing** (open link, min 12 tester × 14 zile continuu) — cerință
   Play din 2024 pentru conturi noi de developer.
3. **Production** — după ce closed testing atinge criteriul de 14 zile.

## 14. Post-release monitoring

- Crashlytics / Firebase (opțional, adaugă `@capacitor-firebase/crashlytics`).
- Play Console → Vitals → ANR & Crash rate < 0.47% (threshold Play).
- Play Console → Pre-launch reports pentru fiecare release candidate.

## 15. Checklist final înainte de "Send for review"

- [ ] `versionCode` incrementat + `versionName` bumped.
- [ ] AAB semnat cu keystore-ul de release (nu debug).
- [ ] `applicationId = app.suzeta` neschimbat.
- [ ] `targetSdkVersion = 35`.
- [ ] `android.allowMixedContent = false` în capacitor.config.ts.
- [ ] Data safety form completat + salvat.
- [ ] Content rating IARC 18+ obținut.
- [ ] Toate cele 5 linkuri legale live pe `suzeta.app`.
- [ ] Screenshots + feature graphic uploadate.
- [ ] Testat pe device fizic (min Android 10 + Android 14).
- [ ] Age gate (Didit) verificat live pe production URL.
- [ ] Push notifications testate cu payload minim ("Ai un mesaj nou").
- [ ] Nicio urmă `console.log` cu date de user în build-ul release.

## 16. Comenzi rapide

```bash
# Development pe device (hot reload din Lovable):
CAPACITOR_DEV=1 npx cap sync android && npx cap run android

# Build production AAB:
bun run build && npx cap sync android && \
  cd android && ./gradlew bundleRelease

# Upload manual → Play Console → Release → Create new release
```

## 17. FCM (Firebase Cloud Messaging) — notificări push native

Wrapper-ul Android folosește FCM prin `@capacitor/push-notifications`.
Web-ul continuă cu Web Push (VAPID) — cele două rulează în paralel, aceeași
tabelă `push_subscriptions` (`kind='fcm'` vs `kind='webpush'`).

### One-time — proiect Firebase

1. Creează proiect Firebase (același `applicationId`: `app.suzeta`).
2. Descarcă `google-services.json` și pune-l în `android/app/`
   (NU comita în repo — adaugă în `.gitignore`).
3. În `android/build.gradle` (top-level), adaugă la `buildscript.dependencies`:
   ```gradle
   classpath 'com.google.gms:google-services:4.4.2'
   ```
4. În `android/app/build.gradle`, la finalul fișierului:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```
5. `bunx cap sync android` — pluginul Capacitor se leagă automat.

### One-time — service account server-side

1. Firebase Console → Project Settings → Service accounts → *Generate new
   private key*. Descarcă JSON-ul.
2. În Lovable Cloud → Project Settings → Secrets, adaugă un secret nou
   `FIREBASE_SERVICE_ACCOUNT_JSON` cu **întregul conținut JSON** ca valoare.
3. Fără acest secret, trimiterea FCM devine no-op și logica webpush rămâne
   funcțională (nu crapă).

### Canale Android

Aplicația creează la primul enable trei canale:
- `messages` (high, sunet + vibrație) — mesaje directe
- `matches` (high, sunet + vibrație) — matches / taps / woofs / likes
- `system` (default) — anunțuri, rezumate

Payload-ul FCM setează `channel_id` server-side; utilizatorul poate ajusta
per-canal din setările Android.
