# Android overrides — Suzeta

Folderul `android/` NU este versionat (îl generezi local cu
`npx cap add android`). Overrides-urile de compliance stau aici și se copiază
AUTOMAT de workflow-ul `.github/workflows/android-release.yml` după `cap sync`.

## Fișiere aplicate automat de workflow

| Fișier | Destinație | De ce |
| ------ | ---------- | ----- |
| `variables.gradle` | `android/variables.gradle` (overwrite) | Forțează `compileSdk=36`, `targetSdk=36`, `minSdk=24` (cerut de pluginul de cameră). Google Play cere targetSdk ≥ 36 (Android 16) pentru încărcări noi. |
| `AndroidManifest.additions.xml` | Fragmente injectate în `android/app/src/main/AndroidManifest.xml` | Scoate `com.google.android.gms.permission.AD_ID` (nu tracking), `ACCESS_BACKGROUND_LOCATION` (geofencing dormant) și documentează App Links `suzeta.app` / `www.suzeta.app` pentru confirmare email, resetare parolă și Didit. |
| `res/mipmap-anydpi-v26/ic_launcher.xml` | `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` | Icon adaptiv Android 8+ cu layer `monochrome` Android 13+. |
| `res/mipmap-anydpi-v26/ic_launcher_round.xml` | idem | Varianta round. |
| `res/drawable/ic_launcher_monochrome.png` | `android/app/src/main/res/drawable/ic_launcher_monochrome.png` | Layer monochrome (heart alb pe negru) pentru themed icons Android 13+. |
| `res/values/splash.xml` | `android/app/src/main/res/values/splash.xml` | `Theme.App.SplashScreen` bazat pe core-splashscreen API (Android 12+). |
| `MainActivity.java` | `android/app/src/main/java/app/suzeta/MainActivity.java` | Expune diagnosticul local: installer, sursa instalării, SHA-1/SHA-256 real și excepția Google fără token-uri. |

## Procedură manuală (dacă rulezi local fără workflow)

```bash
cp android-overrides/variables.gradle android/variables.gradle
cp -r android-overrides/res/* android/app/src/main/res/

# Editează android/app/src/main/AndroidManifest.xml:
# 1) adaugă la <manifest ...>: xmlns:tools="http://schemas.android.com/tools"
# 2) copiază permisiunile din android-overrides/AndroidManifest.additions.xml
#    ÎNAINTE de </manifest>
# 3) copiază intent-filter-ul App Links din același fișier în tag-ul <activity MainActivity>
```

## Verificare merged manifest (workflow o face automat, step "Verifică merged manifest")

```bash
cd android
./gradlew :app:processReleaseManifest
# Confirmă:
#   - <uses-sdk android:targetSdkVersion="36" .../>
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

## Widget home-screen (4x1)

Fișiere: `SuzetaWidgetProvider.java`, `res/layout/widget_suzeta.xml`,
`res/xml/widget_suzeta_info.xml`, `res/values/widget.xml`,
`res/drawable/widget_background.xml`, `widget_button.xml`,
`widget_button_ghost.xml`, plus blocul `<receiver>` din
`AndroidManifest.additions.xml`.

Aplicare: `bun run android:widget:apply`.

Confidențialitate: widget-ul NU afișează mesaje, nume, poze sau distanțe și
nu face niciun apel de rețea. Are exact două acțiuni — App Link către
`/discover` și un sheet de share cu linkul de invitație (UTM `android_widget`).
Nu adaugă nicio permisiune nouă.
