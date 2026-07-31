# Play Console — upload pe track-ul Internal

Ghid complet, fără pași lipsă, pentru a publica un build Suzeta pe trackul
`internal` din Google Play Console. Sursa unică de versiune este
`release/version.json`; changelogs-urile stau la
`fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt`.

## Prerequisite (o singură dată)

1. **Cont Play Console** cu aplicația `app.suzeta` creată.
2. **Service account** cu rol "Release manager":
   - Google Cloud Console → IAM → Service accounts → cheie JSON.
   - Salvează cheia la `release/play-store-service-account.json` (deja în
     `.gitignore`). Alternativ, export `SUPPLY_JSON_KEY=/absolute/path.json`.
3. **Fastlane** local: `gem install bundler && bundle install`.
4. **Keystore** pentru semnare release (nu în repo). Setează în
   `android/app/build.gradle` blocul `signingConfigs.release` cu variabile
   din `~/.gradle/gradle.properties`.
5. **Include versionarea în Gradle** — în `android/app/build.gradle`, imediat
   după `apply plugin`:
   ```gradle
   apply from: "../../release/android-version.gradle"
   android {
     defaultConfig {
       versionCode project.ext.suzetaVersionCode
       versionName project.ext.suzetaVersionName
     }
   }
   ```

## Flow standard pentru un release nou pe internal

```bash
# 1. Bump versiune (creează și skeleton-ul de changelog)
bun run version:bump           # patch (1.0.0 → 1.0.1, code +1)
# sau
bun run version:bump:minor
bun run version:bump:major
# sau exact
node scripts/bump-android-version.mjs set --name=1.2.0 --code=12

# 2. Editează changelog-urile generate (max 500 chars per locale)
$EDITOR fastlane/metadata/android/en-US/changelogs/<code>.txt
$EDITOR fastlane/metadata/android/ro-RO/changelogs/<code>.txt

# 3. Build web + sync Capacitor
bun run build:mobile
npx cap sync android

# 4. Build .aab semnat
cd android && ./gradlew bundleRelease && cd ..

# 5. Validează metadata (fără upload)
bundle exec fastlane android validate

# 6. Upload pe internal (release_status=draft — nu se promovează automat)
bundle exec fastlane android internal
```

După ce apare draft-ul în Play Console → Testing → Internal, îl promovezi
manual la "Rollout to Internal testing".

## Doar metadata / changelogs (fără build nou)

```bash
bundle exec fastlane android metadata_only
```

## Structură fișiere

```
release/
  version.json                 # versionCode + versionName (sursă unică)
  android-version.gradle       # citit din build.gradle
fastlane/
  Appfile                      # package name + service account
  Fastfile                     # lane-uri: bump, validate, internal, metadata_only
  metadata/android/
    en-US/
      title.txt
      short_description.txt
      full_description.txt
      changelogs/<versionCode>.txt
    ro-RO/
      title.txt
      short_description.txt
      full_description.txt
      changelogs/<versionCode>.txt
```

## Reguli Play Store enforced de `fastlane android validate`

- Fiecare locale activ trebuie să aibă `changelogs/<versionCode>.txt`.
- Fișierul nu poate fi gol.
- Max 500 caractere (limita Play Store pentru "What's new").

Dacă validate pică, `internal` refuză uploadul — nu ajungi cu draft incomplet
în Play Console.

## Troubleshooting

- **`Package not found`** → service account nu are acces la app; invită
  emailul contului în Play Console → Users and permissions.
- **`APK specifies a version code that has already been used`** → ai uitat
  `bump`. Rulează `bun run version:bump` și repetă din pasul 3.
- **`aab file not found`** → `./gradlew bundleRelease` a eșuat sau
  keystore-ul nu e configurat; verifică `signingConfigs.release`.
