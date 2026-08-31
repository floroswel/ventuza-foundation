# Release iOS — Suzeta

Nișa de pe iPhone trebuie să poată descărca aplicația și să o recomande.
Web-ul e deja pregătit (Universal Links + CTA App Store); mai rămâne build-ul
nativ, care se face pe macOS.

## 1. Pregătire (o singură dată)

- Cont Apple Developer Program (99 USD/an), rol Admin sau Account Holder.
- Xcode 16+ pe macOS, CocoaPods (`sudo gem install cocoapods`).
- App ID `app.suzeta` în Certificates, Identifiers & Profiles, cu capabilities:
  Associated Domains, Push Notifications.
- App nou în App Store Connect, bundle `app.suzeta`, categorie principală
  „Social Networking”, Age Rating **18+**.

## 2. Build

```bash
bun install
bun run ios:add     # doar prima dată
bun run ios:sync    # build web + cap sync + copiere PrivacyInfo.xcprivacy
bun run ios:open
```

În Xcode: Signing Team, Associated Domains (`applinks:suzeta.app`,
`applinks:www.suzeta.app`), Push Notifications, Deployment Target iOS 15,
apoi `Product → Archive → Distribute App`.

## 3. După primul upload

1. Ia ID-ul numeric al aplicației din App Store Connect (ex. `6740000000`).
2. Setează variabila de build `VITE_APPLE_APP_ID` cu acea valoare — altfel
   linkurile din web trimit spre o căutare, nu spre pagina aplicației, și
   pierdem atribuirea instalărilor iOS.
3. Înlocuiește `APPLE_TEAM_ID` din `public/.well-known/apple-app-site-association`
   cu Team ID-ul real și republică web-ul.
4. Adaugă în `public/manifest.webmanifest`, la `related_applications`:
   `{ "platform": "itunes", "url": "<App Store URL>" }`.

## 4. Ce verifică App Review la o aplicație de dating

| Cerință | Cum e acoperită |
| --- | --- |
| 1.2 User-generated content: raportare, blocare, moderare, filtrare | raportare din card + chat, blocare bilaterală la nivel DB, coadă de moderare foto |
| 1.1.4 Conținut sexual explicit interzis | scanare server-side + review uman înainte de publicare |
| 5.1.1 Permisiuni justificate | textele din `ios-overrides/Info.plist.additions.xml` |
| 5.1.1(v) Ștergere cont în aplicație | `/account-deletion` |
| Age rating 18+ | age gate + verificare Didit |
| Privacy manifest | `ios-overrides/PrivacyInfo.xcprivacy` |
| Account demo pentru review | pregătește un cont `is_seed=true` verificat și trece-l în App Review Notes |

## 5. Push pe iOS

Push-ul rămâne generat de baza de date (`push_outbox`), la fel ca pe Android.
Pentru APNs: cheie `.p8` (Keys → Apple Push Notifications service) încărcată în
Firebase Console → Project settings → Cloud Messaging → APNs Authentication Key.
Nu se schimbă nimic în client: `@capacitor/push-notifications` folosește
același flux de înregistrare a tokenului.
