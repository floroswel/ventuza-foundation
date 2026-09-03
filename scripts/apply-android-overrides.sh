#!/usr/bin/env bash
# Copiază overrides-urile Android (inclusiv widget-ul home-screen) peste
# proiectul generat de `npx cap add android`. Idempotent.
set -euo pipefail

if [ ! -d "android/app/src/main" ]; then
  echo "→ android/ lipsește. Rulează întâi: npx cap add android"
  exit 0
fi

cp android-overrides/variables.gradle android/variables.gradle
cp -r android-overrides/res/* android/app/src/main/res/
if [ -f android-overrides/google-services.json ]; then
  cp android-overrides/google-services.json android/app/google-services.json
fi
mkdir -p android/app/src/main/java/app/suzeta
cp android-overrides/MainActivity.java android/app/src/main/java/app/suzeta/MainActivity.java
cp android-overrides/SuzetaWidgetProvider.java android/app/src/main/java/app/suzeta/SuzetaWidgetProvider.java

MANIFEST="android/app/src/main/AndroidManifest.xml"
if grep -q "SuzetaWidgetProvider" "$MANIFEST"; then
  echo "✓ Widget-ul e deja declarat în AndroidManifest.xml"
else
  echo "⚠ Adaugă în <application> blocul <receiver> din android-overrides/AndroidManifest.additions.xml"
fi

echo "✓ Overrides Android aplicate (inclusiv widget)."
