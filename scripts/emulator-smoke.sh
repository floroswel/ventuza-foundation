#!/usr/bin/env bash
# Smoke test pe emulator: instalează APK-ul universal, pornește aplicația și
# verifică să nu crape în primele 15 secunde.
#
# ATENȚIE: reactivecircus/android-emulator-runner execută `script:` linie cu
# linie prin `sh -c`, deci blocurile multi-linie (`if ... fi`) dau
# „Syntax error: end of file unexpected". De aceea logica stă aici, într-un
# fișier, iar workflow-ul rulează o singură linie.
set -euo pipefail

APK="${1:-/tmp/apks/universal.apk}"
PKG="app.suzeta"

adb install -r "$APK"
adb logcat -c
adb shell am start -n "$PKG/$PKG.MainActivity"
sleep 15

if ! adb shell pidof "$PKG" > /dev/null; then
  echo "::error::Aplicația s-a închis singură după pornire (crash la boot)."
  adb logcat -d -t 400 | grep -iE "AndroidRuntime|FATAL|$PKG" | tail -80 || true
  exit 1
fi

if adb logcat -d | grep -q "FATAL EXCEPTION"; then
  echo "::error::FATAL EXCEPTION în logcat la pornire."
  adb logcat -d | grep -A 40 "FATAL EXCEPTION" | tail -80 || true
  exit 1
fi

echo "✓ Aplicația pornește și rămâne activă 15s pe emulator."
