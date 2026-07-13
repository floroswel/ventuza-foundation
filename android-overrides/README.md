# Android overrides — Ventuza

Folderul `android/` NU este versionat (îl generezi local cu
`npx cap add android`). Overrides-urile de compliance stau aici și le copiezi
DUPĂ generarea proiectului nativ.

## Fișiere

| Fișier | Destinație | De ce |
| ------ | ---------- | ----- |
| `variables.gradle` | `android/variables.gradle` (înlocuiește) | Forțează `compileSdk=35`, `targetSdk=35`, `minSdk=23`. Google Play cere targetSdk ≥ 34 (Android 14) de la 31.08.2025. |
| `AndroidManifest.additions.xml` | Fragmente în `android/app/src/main/AndroidManifest.xml` | Scoate `com.google.android.gms.permission.AD_ID` (nu folosim advertising) și `ACCESS_BACKGROUND_LOCATION` (geofencing dormant). |

## Procedură (o singură dată după `npx cap add android`)

```bash
cp android-overrides/variables.gradle android/variables.gradle

# Editează android/app/src/main/AndroidManifest.xml:
# 1) adaugă la <manifest ...> namespace-ul: xmlns:tools="http://schemas.android.com/tools"
# 2) copiază permisiunile din android-overrides/AndroidManifest.additions.xml
#    ÎNAINTE de </manifest>
```

## Verificare merged manifest

```bash
cd android
./gradlew :app:processReleaseManifest
# Deschide app/build/intermediates/merged_manifests/release/AndroidManifest.xml
# Confirmă:
#   - <uses-sdk android:targetSdkVersion="35" .../>
#   - NU apare com.google.android.gms.permission.AD_ID
#   - NU apare android.permission.ACCESS_BACKGROUND_LOCATION
```

## Cross-check cu Play Data Safety

Documentul `docs/play-console-data-safety.md` declară `AD_ID = No`. Dacă
uiți să scoți permisiunea, Play te va marca "Discrepancy detected" în
Data Safety review și îți poate bloca lansarea.
