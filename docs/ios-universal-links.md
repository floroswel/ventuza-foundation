# iOS Universal Links (Suzeta)

Web-ul trimite deja userii iOS în aplicație prin Universal Link, cu fallback
automat în App Store (`src/lib/store-links.ts` → `openAppOrStore`).

## Ce trebuie completat la publicarea aplicației iOS

1. **Team ID** — înlocuiește `APPLE_TEAM_ID` din
   `public/.well-known/apple-app-site-association` cu Team ID-ul real
   (Apple Developer → Membership). Rezultat: `ABCDE12345.app.suzeta`.
   Fișierul se servește la `https://suzeta.app/.well-known/apple-app-site-association`
   cu `Content-Type: application/json`, fără redirect.
2. **App ID numeric** — setează variabila de build `VITE_APPLE_APP_ID`
   (ex. `6740000000`). Fără ea, linkurile de App Store cad pe o căutare după
   „suzeta”, deci atribuția nu e exactă.
3. **Xcode** — capability „Associated Domains” cu
   `applinks:suzeta.app` și `applinks:www.suzeta.app`.
4. **Manifest web** — adaugă în `public/manifest.webmanifest`, în
   `related_applications`, intrarea `{ "platform": "itunes", "url": "<App Store URL>" }`
   ca `getInstalledRelatedApps()` să poată raporta și iOS acolo unde e suportat.

## Atribuire

Evenimentele de funnel sunt separate, ca să știm exact ce cale a folosit userul:

| eveniment | ce înseamnă |
|---|---|
| `app_link_open` | Universal Link (iOS) / App Link (Android) a deschis aplicația |
| `intent_open` | `intent://` pe Android a deschis aplicația instalată |
| `store_click` | userul a fost trimis în Google Play / App Store |
| `install_first_open` | prima deschidere a aplicației native (conversia de instalare) |

Toate purtă `source` (buton), `variant` (test A/B) și `referrer` (UTM efectiv).
