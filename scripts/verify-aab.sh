#!/usr/bin/env bash
# Checklist obligatoriu înainte de fiecare build AAB (Google Play).
# Rulează din rădăcina proiectului:  bash scripts/verify-aab.sh
set -euo pipefail

echo "==> 1. Build curat"
rm -rf dist android/app/src/main/assets/public
bun run build:mobile

echo "==> 2. index.html prezent"
ls -l dist/client/index.html

echo "==> 3. URL-uri absolute în bundle"
if grep -rl "https://suzeta.app" dist/client/ >/dev/null 2>&1; then
  echo "ATENȚIE: există referințe absolute (ok doar pentru API origin rewrite):"
  grep -rl "https://suzeta.app" dist/client/ | head -20
else
  echo "OK - no absolute URLs"
fi

echo "==> 4. Sync Capacitor"
npx cap sync android

echo "==> 5. AndroidManifest flags"
grep -E "allowBackup|usesCleartextTraffic|networkSecurityConfig" \
  android/app/src/main/AndroidManifest.xml || echo "(niciun flag setat explicit)"

echo "==> 6. Build AAB"
cd android && ./gradlew bundleRelease
echo "AAB: android/app/build/outputs/bundle/release/app-release.aab"
