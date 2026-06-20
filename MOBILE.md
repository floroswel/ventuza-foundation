# Ventuza — Build mobil (Android, Google Play)

Aplicația este împachetată cu **Capacitor**. Asta înseamnă că aceeași bază de cod web rulează și ca APK/AAB nativ pentru Google Play, iar plățile Premium se vor face prin **Google Play Billing** (obligatoriu pentru produse digitale în Play Store).

---

## 1. Pregătire o singură dată

Ai nevoie de:

- **Node 20+** și **Bun** (deja folosite în proiect)
- **Android Studio** (Hedgehog sau mai nou) cu **Android SDK 34+** și **JDK 17**
- **Cont Google Play Developer** ($25 one-time) — pentru publicare

Clonează repo-ul local (din GitHub-ul conectat la Lovable), apoi:

```bash
bun install
bun run build           # generează /dist
npx cap add android     # creează folderul /android (o singură dată)
```

> Folderul `/android` NU este versionat în Lovable — îl generezi tu local.

---

## 2. Două moduri de dezvoltare

### A. Hot-reload de pe preview-ul Lovable (cel mai rapid)

`capacitor.config.ts` conține deja `server.url` cu preview-ul Lovable. Telefonul încarcă direct ce vezi în Lovable, fără rebuild.

```bash
npx cap sync android
npx cap run android       # rulează pe emulator/device USB
```

Schimbi cod în Lovable → faci refresh în app. Util pentru iterație vizuală.

### B. Build de producție pentru Google Play

```bash
# 1. Comentează blocul `server: { url: ... }` din capacitor.config.ts
# 2. Build web
bun run build
npx cap sync android

# 3. Deschide Android Studio
npx cap open android
# 4. Build > Generate Signed Bundle / APK > Android App Bundle (.aab)
```

Încarci `.aab`-ul în Play Console → Internal Testing → Production.

---

## 3. Google Play Billing (Premium)

Cod-ul backend este pregătit:
- Tabela `subscriptions` și funcția `has_active_subscription(user_id)` există deja.
- Server function-ul `recordGooglePlayPurchase` din `src/lib/account.functions.ts` este stub — primește `purchaseToken` + `productId` și înregistrează abonamentul.

### Ce trebuie să faci tu în Play Console:

1. **Creează aplicația** în Play Console (package: `app.ventuza.mobile`).
2. **Monetizare → Produse → Abonamente** → adaugă SKU-urile:
   - `ventuza_premium_monthly`
   - `ventuza_premium_yearly`
3. **Setup → Acces API** → leagă un proiect Google Cloud → creează un **Service Account** cu rol "Pub/Sub Admin" + acces Play Developer API.
4. Descarcă cheia JSON a service account-ului.
5. În Lovable, adaugă-o ca secret cu numele `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (Settings → Backend → Secrets).

După ce ai cheia, îmi spui și activez validarea reală a token-urilor server-side (în loc de stub-ul actual) + endpoint-ul Real-Time Developer Notifications pentru reînnoiri/anulări.

### Plugin pentru Billing în app

Recomandat: **RevenueCat** (gratuit până la $10K MTR, gestionează automat validarea și sincronizarea cross-platform):

```bash
bun add @revenuecat/purchases-capacitor
```

Sau Google Play Billing direct prin `@capacitor-community/in-app-purchases`. Spune-mi care preferi și îl integrez.

---

## 4. Checklist înainte de a publica pe Play

- [ ] Cont Google Play Developer activ + identitate verificată
- [ ] Privacy Policy hostată la URL public (avem `/legal/privacy` — îl folosim)
- [ ] Terms hostate la URL public (`/legal/terms`)
- [ ] **Data Safety form** completat (obligatoriu pentru dating + date de sănătate)
- [ ] **Content rating**: Mature 17+ (dating)
- [ ] **App category**: Dating
- [ ] Screenshots: minim 2 telefon (1080×1920 sau similar)
- [ ] Feature graphic 1024×500
- [ ] Icon 512×512 PNG
- [ ] Descriere lungă + scurtă (RO + EN recomandat)
- [ ] Politica privind conținutul sexual / dating respectată (NO nudity, NO escort)
- [ ] Email suport activ: `support@ventuza.app`

---

## 5. Probleme cunoscute

- **Camera / Galerie pentru poze profil**: dacă vrei selector nativ în loc de `<input type="file">`, adaugă `@capacitor/camera`.
- **Push notifications native**: necesită `@capacitor/push-notifications` + Firebase Cloud Messaging.
- **Deep links** (ex: `ventuza://match/123`): config în `AndroidManifest.xml` + handler în root route.

Toate sunt opționale pentru lansarea v1 — îmi spui când vrei să le adăugăm.
