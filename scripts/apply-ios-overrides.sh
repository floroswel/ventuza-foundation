#!/usr/bin/env bash
# Copiază fișierele de compliance iOS peste proiectul generat de `npx cap add ios`.
# Rulat automat de `bun run ios:sync`. Idempotent.
set -euo pipefail

APP_DIR="ios/App/App"

if [ ! -d "$APP_DIR" ]; then
  echo "→ ios/ lipsește. Rulează întâi: bun run ios:add (necesită macOS + Xcode)."
  exit 0
fi

cp ios-overrides/PrivacyInfo.xcprivacy "$APP_DIR/PrivacyInfo.xcprivacy"
echo "✓ PrivacyInfo.xcprivacy copiat în $APP_DIR"

if grep -q "NSCameraUsageDescription" "$APP_DIR/Info.plist"; then
  echo "✓ Info.plist conține deja cheile de confidențialitate"
else
  echo "⚠ Adaugă manual cheile din ios-overrides/Info.plist.additions.xml în $APP_DIR/Info.plist"
fi

echo "→ În Xcode: Associated Domains (applinks:suzeta.app, applinks:www.suzeta.app) + Push Notifications."
