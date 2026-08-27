# Handover Suzeta — pachetul complet de chei pentru cumpărător

Scop: după transfer, cumpărătorul trebuie să poată face **build + update pe Google Play**
și să opereze backend-ul fără tine. Documentul e împărțit pe: (A) ce transferi,
(B) de unde iei fiecare cheie, (C) ce ROTEȘTI după vânzare.

---

## A. Inventar complet — ce trebuie predat

| # | Element | Unde trăiește azi | Critic? |
|---|---|---|---|
| 1 | **Upload keystore Android** (`release.keystore` + 3 parole) | password manager + GitHub Secrets | 🔴 Fără el nu există update sub `app.suzeta` |
| 2 | **Cont Google Play Developer** (deținerea app-ului `app.suzeta`) | Play Console | 🔴 |
| 3 | **Service account Play** (`PLAY_SERVICE_ACCOUNT_JSON`) | GitHub Secrets `production` | 🟠 CI upload automat |
| 4 | **Repository GitHub** (cod + workflows) | GitHub | 🔴 |
| 5 | **Proiect Lovable + Lovable Cloud** (backend/DB/auth/storage) | Lovable | 🔴 |
| 6 | **Firebase / FCM** (`google-services.json` + `FIREBASE_SERVICE_ACCOUNT_JSON`) | Firebase Console + secrets | 🟠 push native |
| 7 | **Domenii** `suzeta.ro`, `suzeta.app` + DNS | registrar | 🔴 |
| 8 | **Didit** (verificare 18+): API key + webhook secret | Didit dashboard | 🔴 fără ea nu intră useri noi |
| 9 | **Cloudflare Turnstile** (`VITE_TURNSTILE_SITE_KEY` + secret) | Cloudflare | 🟠 anti-bot |
| 10 | **Email transacțional** (domeniu + DNS SPF/DKIM) | provider email | 🟠 |
| 11 | **VAPID Web Push** (public/private key) | secrets backend | 🟡 |
| 12 | **Cheia de cifrare date sănătate** `HEALTH_COL_KEY` | secret backend | 🔴 pierdere = date HIV nedecriptabile |
| 13 | **Conturi legale**: DPO, adresă notificări DSA/DMCA, ANSPDCP | documente | 🟠 |

---

## B. De unde iei / cum verifici fiecare cheie

### 1. Upload keystore Android
- **Dacă îl ai**: fișierul `release.keystore` + `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS` (`suzeta-upload`), `ANDROID_KEY_PASSWORD`.
- **Dacă l-ai pierdut**: NU se recuperează. Dar dacă app-ul e înrolat în
  **Play App Signing** (este, la prima urcare), ceri Google *upload key reset*:
  Play Console → Setup → App integrity → App signing → „Request upload key reset".
  Generezi unul nou cu workflow-ul **Bootstrap Android Keystore** din Actions.
- Predare: fișierul `.keystore` + parolele, într-un item de password manager
  partajat (nu pe email/WhatsApp).

### 2. Cont Google Play Developer
Două variante:
- **Transfer app** (recomandat dacă cumpărătorul are cont propriu):
  Play Console → Setup → **App transfer**. Ai nevoie de: Transaction ID de la
  cumpărător (achiziția contului lui) + ambele conturi verificate. Durează câteva zile.
- **Transfer cont complet**: vinzi contul de developer — Google cere formular
  „Change of ownership" și verificare de identitate a noului deținător.
- ⚠️ Nu se poate publica update la `app.suzeta` de pe alt cont fără transfer.

### 3. `PLAY_SERVICE_ACCOUNT_JSON`
Nu se „recuperează" — se regenerează, oricând:
1. Play Console → **Setup → API access** → proiect Google Cloud legat.
2. Google Cloud Console → IAM → **Service Accounts** → `play-publisher-ci` →
   Keys → **Add key → JSON** → descarci.
3. Play Console → API access → contul → **Grant access**:
   *Releases → Manage production and testing tracks* + *View app information*.
4. GitHub → Settings → Environments → `production` → Secret
   `PLAY_SERVICE_ACCOUNT_JSON` = conținutul integral al JSON-ului.

### 4. Repository GitHub
- Settings → General → **Transfer ownership** către contul/org-ul cumpărătorului.
- Secretele NU se transferă la mutarea repo-ului între conturi personale în
  toate cazurile → cumpărătorul le re-adaugă (lista din secțiunea A).

### 5. Lovable + Lovable Cloud
- Transferi proiectul în workspace-ul cumpărătorului (Lovable → Project Settings
  → Transfer), sau îi dai ownership pe workspace.
- Backend-ul (DB, auth, storage, secretele runtime) merge împreună cu proiectul.

### 6. Firebase / FCM
- Firebase Console → Project Settings → **Users and permissions** → adaugi
  cumpărătorul ca **Owner**, apoi te scoți pe tine.
- `google-services.json`: Project Settings → General → app Android → download.
  În CI e secretul `GOOGLE_SERVICES_JSON_BASE64`.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Project Settings → Service accounts →
  Generate new private key.

### 7. Domenii
- Registrar → transfer domeniu (cod EPP/auth code) sau transfer cont.
- După transfer: verificat DNS-ul (A/CNAME către Lovable, TXT pentru email),
  plus `assetlinks.json` (App Links) rămâne servit de `suzeta.app`.

### 8. Didit (age verification)
- Didit dashboard → API keys → cumpărătorul își creează propriul workspace și
  cheie, sau transferați organizația (contactezi suportul Didit).
- Secrete în app: `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`.
- ⚠️ Webhook URL trebuie repointat: `https://suzeta.app/api/public/didit-webhook`.

### 9. Turnstile
- Cloudflare → Turnstile → site nou pe domeniul lui → site key (public, în
  `VITE_TURNSTILE_SITE_KEY`) + secret key (Supabase Auth → Bot protection).

### 10–12. Secrete backend
Se re-generează, nu se recuperează:
- **VAPID**: `npx web-push generate-vapid-keys` → public în client, private în secret.
  ⚠️ Schimbarea VAPID invalidează abonamentele web-push existente (userii se
  reabonează automat la următoarea deschidere).
- **`HEALTH_COL_KEY`**: NU o schimba fără re-cifrare. Se predă ca atare.
  Pierderea = datele de sănătate rămân necitibile permanent.

---

## C. Ce ROTEȘTE cumpărătorul imediat după preluare

Obligatoriu, în prima zi:
1. `PLAY_SERVICE_ACCOUNT_JSON` — cheie nouă, o șterge pe cea veche din GCP.
2. `FIREBASE_SERVICE_ACCOUNT_JSON` — cheie nouă.
3. `DIDIT_API_KEY` + `DIDIT_WEBHOOK_SECRET`.
4. Turnstile secret key.
5. Parolele conturilor admin din app + revocare `super_admin` pentru vânzător
   (Admin → Roluri).
6. Chei API Lovable / rotire prin Project Settings.
7. Schimbă emailurile legale (DPO, DSA, abuse) în `src/routes/legal.*`.

NU roti: `HEALTH_COL_KEY` (fără migrare de re-cifrare) și keystore-ul de upload
(decât prin procedura oficială Google de reset).

---

## D. Test de acceptanță — „cumpărătorul poate face update singur"

Verificare finală, făcută de cumpărător, fără ajutorul vânzătorului:

1. GitHub → Actions → **Android Release** → track `internal`,
   „Doar produce AAB" = dezactivat → rulează.
2. Pasul *Preflight secrete* arată toate ✅.
3. Build-ul apare în Play Console → Internal testing.
4. GitHub → Actions → **Android Promote** → `from_track: internal`,
   `percent: 100` → apare în Production.
5. Aplicația instalată din Play primește update-ul.

Dacă cei 5 pași trec, handover-ul e complet.

---

## E. Formă de predare recomandată

Un singur vault partajat (1Password / Bitwarden „Collection") cu:
- `release.keystore` (atașament) + item cu cele 3 parole
- `play-service-account.json`
- `google-services.json` + `firebase-service-account.json`
- listă `.env` de producție (fără a le lăsa în repo)
- `HEALTH_COL_KEY`, VAPID private key
- credențiale registrar domenii, Didit, Cloudflare
- acest document

După semnarea transferului: revoci accesul tău la vault, GitHub, Lovable,
Firebase, Play Console și Didit.
