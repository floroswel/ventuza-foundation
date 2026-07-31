# Android overrides — Suzeta

Folderul `android/` NU este versionat (îl generezi local cu
`npx cap add android`). Overrides-urile de compliance stau aici și se copiază
AUTOMAT de workflow-ul `.github/workflows/android-release.yml` după `cap sync`.

## Fișiere aplicate automat de workflow

| Fișier | Destinație | De ce |
| ------ | ---------- | ----- |
| `variables.gradle` | `android/variables.gradle` (overwrite) | Forțează `compileSdk=36`, `targetSdk=35`, `minSdk=24` (cerut de pluginul de cameră). Google Play cere targetSdk ≥ 34 de la 31.08.2025. |
| `AndroidManifest.additions.xml` | Fragmente injectate în `android/app/src/main/AndroidManifest.xml` | Scoate `com.google.android.gms.permission.AD_ID` (nu tracking) și `ACCESS_BACKGROUND_LOCATION` (geofencing dormant). |
| `res/mipmap-anydpi-v26/ic_launcher.xml` | `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` | Icon adaptiv Android 8+ cu layer `monochrome` Android 13+. |
| `res/mipmap-anydpi-v26/ic_launcher_round.xml` | idem | Varianta round. |
| `res/drawable/ic_launcher_monochrome.png` | `android/app/src/main/res/drawable/ic_launcher_monochrome.png` | Layer monochrome (heart alb pe negru) pentru themed icons Android 13+. |
| `res/values/splash.xml` | `android/app/src/main/res/values/splash.xml` | `Theme.App.SplashScreen` bazat pe core-splashscreen API (Android 12+). |

## Procedură manuală (dacă rulezi local fără workflow)

```bash
cp android-overrides/variables.gradle android/variables.gradle
cp -r android-overrides/res/* android/app/src/main/res/

# Editează android/app/src/main/AndroidManifest.xml:
# 1) adaugă la <manifest ...>: xmlns:tools="http://schemas.android.com/tools"
# 2) copiază permisiunile din android-overrides/AndroidManifest.additions.xml
#    ÎNAINTE de </manifest>
```

## Verificare merged manifest (workflow o face automat, step "Verifică merged manifest")

```bash
cd android
./gradlew :app:processReleaseManifest
# Confirmă:
#   - <uses-sdk android:targetSdkVersion="35" .../>
#   - NU apare com.google.android.gms.permission.AD_ID (fără tools:node="remove")
#   - NU apare android.permission.ACCESS_BACKGROUND_LOCATION
```

## Cross-check cu Play Data Safety

Documentul `docs/play-console-data-safety.md` declară `AD_ID = No`. Workflow-ul
eșuează build-ul dacă permisiunea reapare accidental în merged manifest.

## Iconițe & splash (generate în CI)

Sursa de brand: `assets/logo.png`, `assets/logo-dark.png`, `assets/splash.png`,
`assets/splash-dark.png` (1024×1024 / 2732×2732, PNG valid).

Workflow-ul `android-release.yml` rulează `@capacitor/assets generate --android`
DUPĂ `cap sync` și ÎNAINTE de copierea `android-overrides/res/*`, ca override-urile
(monochrome icon, splash theme) să rămână ultimele.

## Gate de validare resurse

Pasul „Validează resursele Android" oprește build-ul înainte de Gradle dacă:
PNG/JPEG/WEBP invalid sau deghizat, XML neparsabil, resurse duplicate în `values*/`,
sau referințe `@drawable/@mipmap/@color/@style/@string` inexistente.
