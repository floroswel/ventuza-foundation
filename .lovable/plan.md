# Raport analiză — Domenii & URL-uri de actualizat după mutarea pe `ventuza.app`

**Zero modificări făcute.** Doar audit. Aprobă acest plan doar dacă vrei să treci în build mode pentru fix-uri; altfel respinge-l și folosește raportul ca referință pentru dashboard-urile externe.

---

## 1. DIDIT — URL-uri & configurări

### 1a. Endpoint-uri Didit (unde apelăm noi)

| Scop | URL | Definit în |
|---|---|---|
| Crearea sesiunii de verificare | `https://verification.didit.me/v3/session/` | `src/lib/age-verification.functions.ts:56` (hardcodat, e URL-ul API-ului Didit — **NU trebuie schimbat**) |

### 1b. URL-uri pe care Didit le apelează la noi (astea trebuie actualizate în dashboard Didit)

| Scop | Cum se construiește | URL efectiv acum |
|---|---|---|
| **Callback (redirect user după verificare)** | Dinamic din browser: `${window.location.origin}${location.pathname}` — trimis ca `callbackUrl` server-side către Didit | Depinde de unde e userul când apasă „verifică" — de obicei `https://ventuza.app/n` sau `https://ventuza.app/account`. **Nu e hardcodat**, deci se adaptează singur la orice domeniu. ✅ |
| **Webhook (Didit → noi, decizia verificării)** | Ruta server: `/api/public/age-webhook` | `https://ventuza.app/api/public/age-webhook` |

**Sursă callback:** `src/components/AgeGate.tsx:131` → `const callbackUrl = ${window.location.origin}${location.pathname}`

**Sursă webhook:** `src/routes/api/public/age-webhook.ts` (ruta publică, verificată prin HMAC cu `DIDIT_WEBHOOK_SECRET`)

### 1c. Env vars Didit (nume, nu valori)

| Nume | Tip | Fișier |
|---|---|---|
| `DIDIT_API_KEY` | server secret | `src/lib/age-verification.functions.ts:44` |
| `DIDIT_WORKFLOW_ID` | server config | `src/lib/age-verification.functions.ts:45` |
| `DIDIT_WEBHOOK_SECRET` | server secret (HMAC) | `src/routes/api/public/age-webhook.ts:18` |

Toate sunt `process.env.*` (server-only). **Zero valori în cod.** ✅

### 1d. Ce trebuie să pui în dashboard Didit

| Câmp Didit | Valoare nouă |
|---|---|
| Webhook URL | `https://ventuza.app/api/public/age-webhook` |
| Callback / Redirect URL allow-list | `https://ventuza.app/*` (sau minim: `https://ventuza.app/n`, `https://ventuza.app/account`, `https://ventuza.app/`) |
| Domenii permise (dacă există câmp) | `ventuza.app` |

**IMPORTANT:** păstrează în paralel și `https://ventuza-foundation.lovable.app/*` + `https://id-preview--*.lovable.app/*` cât timp folosești preview-ul Lovable pentru testing, altfel verificarea eșuează în dev.

---

## 2. Alte integrări cu URL-uri / domenii de actualizat

### 2a. Supabase Auth — Site URL & Redirect allow-list ⚠️ **CRITIC**

Nu am acces la config-ul Supabase Auth din cod (e în dashboard). Verifică manual în **Cloud → Auth → URL Configuration**:

| Câmp | Valoare nouă necesară |
|---|---|
| Site URL | `https://ventuza.app` |
| Redirect URLs (allow-list) | `https://ventuza.app/**`, `https://www.ventuza.app/**`, `https://ventuza-foundation.lovable.app/**` (păstrat pentru staging), `https://id-preview--*.lovable.app/**` (păstrat pentru preview) |

**De ce contează:** `emailRedirectTo` din `signUp()` (auth.tsx:235) folosește `window.location.origin` — dacă `ventuza.app` nu e în allow-list, confirmarea emailului redirectează la Site URL implicit.

### 2b. Google OAuth (managed prin Lovable Cloud)

Codul folosește `redirect_uri: window.location.origin` (dinamic) prin `lovable.auth.signInWithOAuth("google", ...)`. Custom domain-urile sunt **automat în allow-list** conform docs Lovable. ✅ **Nu necesită acțiune** dacă `ventuza.app` e activ în Lovable ca custom domain.

### 2c. Google Play (RTDN webhook)

| Scop | URL nou |
|---|---|
| RTDN webhook în Google Play Console | `https://ventuza.app/api/public/google-play-rtdn` |

Sursă: `src/routes/api/public/google-play-rtdn.tsx:6` (comentariu spune deja `https://ventuza.app/...`, deci codul e ok — doar dashboard-ul Google Play trebuie verificat).

### 2d. RevenueCat

- `src/lib/revenuecat.server.ts` folosește `https://api.revenuecat.com/v1/...` — asta e API-ul lor, nu se schimbă.
- **Verifică în dashboard RevenueCat:** dacă ai webhook configurat spre app-ul tău (ex: `https://.../api/public/revenuecat-webhook`), asigură-te că indică spre `ventuza.app`. Nu am găsit un webhook RevenueCat inbound în cod (`rg` nu returnează match), deci probabil nu ai unul — doar apeluri outbound.

### 2e. Cloudflare Turnstile

`VITE_TURNSTILE_SITE_KEY` e definită în `.env` (fără valoare vizibilă). **Verifică în dashboard Cloudflare Turnstile** că domain-urile permise pentru site key-ul curent includ:
- `ventuza.app`
- `www.ventuza.app`
- `ventuza-foundation.lovable.app` (staging)
- `id-preview--*.lovable.app` (preview) — dacă Cloudflare acceptă wildcard

Fără astea, captcha va da eroare pe production.

### 2f. Web Push (VAPID)

`src/lib/web-push.server.ts:8` → `VAPID_SUBJECT = "mailto:hello@ventuza.app"` ✅ deja corect.

⚠️ Notă separată de securitate (nu e task-ul curent, dar merită menționat): `VAPID_PRIVATE` e hardcodat în `src/lib/web-push.server.ts:7`. Are TODO de rotire — nu e legat de mutarea de domeniu.

---

## 3. Bug-uri de domeniu în cod (nu în dashboarde) — recomandat de rezolvat

| Fișier | Linia | Problemă | Fix propus |
|---|---|---|---|
| `src/lib/admin-legal.functions.ts` | 151, 179 | Adresă `dpo@ventuza.eu` hardcodată în template email | Schimbă în `dpo@ventuza.app` (restul proiectului folosește `.app`) |
| `src/routes/account-deletion.tsx` | 11, 67, 70, 120, 121 | `dpo@ventuza.eu` în UI public | Schimbă în `dpo@ventuza.app` |
| `src/routes/account.tsx` | 295 | `support@ventuza.eu` în mailto | Schimbă în `support@ventuza.app` |
| `src/components/ShareProfileCard.tsx` | 11 | Fallback SSR: `https://ventuza.com` (nu `.app`) când `window` lipsește | Schimbă în `https://ventuza.app` |
| `src/lib/__tests__/signup-guard.test.ts` | 22 | Constantă test: `https://ventuza-foundation.lovable.app` | OK pentru test, dar merită normalizat la `ventuza.app` |
| `src/routes/__root.tsx` | 120, 125 | OG image indică spre `id-preview-...lovable.app` (URL vechi de preview) | Regenerează OG cover cu domeniu `ventuza.app` sau lasă (R2 asset — funcționează, doar arată vechi) |

---

## 4. Ce e OK deja și NU trebuie atins

- ✅ `src/lib/referrals.ts:24` — folosește `ventuza.app`
- ✅ `src/routes/api/public/google-play-rtdn.tsx` — comentariu indică `ventuza.app`
- ✅ `src/routes/lovable/email/auth/preview.ts:29` — `SAMPLE_PROJECT_URL = "https://ventuza.app"`
- ✅ Toate template-urile de email (webhook.ts) folosesc `ROOT_DOMAIN = "ventuza.app"` + `SENDER_DOMAIN = "notify.ventuza.app"`
- ✅ Toate paginile legale (`legal.cookies`, `legal.dmca`, `legal.age-policy`, `legal.community`, `legal.business-terms`, `legal.records-of-processing`, `legal.subprocessors`) folosesc `@ventuza.app`
- ✅ `age-gate-policy.ts` gestionează corect toate host-urile (localhost, id-preview, dev.lovable.app) — nu necesită modificare pentru custom domain (default = forțează ON în producție, ceea ce include `ventuza.app`)

---

## Recomandare acțiuni externe (dashboard-uri)

**Ordine de execuție în dashboard-uri:**

1. **Supabase Auth** — adaugă `https://ventuza.app` ca Site URL + redirect allow-list ⚠️ P0 (blochează login-ul altfel)
2. **Didit dashboard** — actualizează webhook la `https://ventuza.app/api/public/age-webhook` + redirect allow-list ⚠️ P0
3. **Google Play Console** — schimbă RTDN webhook la `https://ventuza.app/api/public/google-play-rtdn` (P1)
4. **Cloudflare Turnstile** — adaugă `ventuza.app` în domain allow-list (P0 pentru login)
5. **RevenueCat** — verifică că nu ai webhook inbound spre vechea platformă (probabil OK)

## Recomandare acțiuni în cod (dacă aprobi build mode)

Cele 6 fix-uri din secțiunea 3 (schimbări simple text `ventuza.eu` → `ventuza.app` + `ventuza.com` → `ventuza.app`). Total: ~10 modificări în 5 fișiere. Ar dura sub 2 minute.

**Zero risc:** sunt doar update-uri de string-uri user-facing (email-uri contact, URL fallback SSR). Nu ating nicio logică.

Aprobă planul → intru în build mode și le fac. Respinge-l → păstrezi raportul ca referință.
