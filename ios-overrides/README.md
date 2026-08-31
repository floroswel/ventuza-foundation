# iOS overrides — Suzeta

Folderul `ios/` NU este versionat (îl generezi cu `npx cap add ios` pe macOS,
cu Xcode 16+). Aici stau doar fișierele de compliance care se copiază peste
proiectul generat.

## Pași build iOS (macOS)

```bash
bun install
bun run build:mobile          # generează dist/client (SPA static, fără SSR)
npx cap add ios               # o singură dată
npx cap sync ios
open ios/App/App.xcworkspace
```

În Xcode:

1. **Signing & Capabilities** → Team-ul Apple Developer, Bundle ID `app.suzeta`.
2. **Associated Domains**: `applinks:suzeta.app`, `applinks:www.suzeta.app`
   (fișierul `public/.well-known/apple-app-site-association` există deja —
   înlocuiește `APPLE_TEAM_ID` cu Team ID-ul real).
3. **Push Notifications** + **Background Modes → Remote notifications**.
4. Copiază cheile de confidențialitate din `Info.plist.additions.xml` în
   `ios/App/App/Info.plist` (App Store respinge build-ul fără ele).
5. **Deployment target**: iOS 15.0.
6. `Product → Archive` → `Distribute App` → App Store Connect.

## Variabile de build

| Variabilă | Rol |
| --- | --- |
| `VITE_APPLE_APP_ID` | ID-ul numeric App Store; fără el, linkurile din web cad pe căutare după „suzeta”, deci atribuirea instalărilor iOS se pierde. |

## Fișiere din acest folder

| Fișier | Destinație |
| --- | --- |
| `Info.plist.additions.xml` | chei de confidențialitate + `ITSAppUsesNonExemptEncryption` în `ios/App/App/Info.plist` |
| `PrivacyInfo.xcprivacy` | `ios/App/App/PrivacyInfo.xcprivacy` — manifestul de confidențialitate cerut de Apple |

## De reținut

- Aplicația e 18+: în App Store Connect, Age Rating trebuie setat `18+`
  (Frequent/Intense Sexual Content or Nudity: None — conținutul explicit e
  interzis prin moderare, dar categoria „Dating” impune 17+/18+).
- Verificarea vârstei rămâne Didit (nu Apple Sign-in, nu document).
- Login-ul Google este dezactivat; nu adăuga „Sign in with Apple” fără să
  reactivezi întâi un provider social — regula App Store 4.8 se aplică doar
  dacă există login social.
