# CI/CD Android — Google Play (automat)

Pipeline: `.github/workflows/android-release.yml`

## Ce face

1. Se declanșează la push de tag SemVer (`v1.2.3`) sau manual din GitHub Actions.
2. Build web (`bun run build`) → Capacitor sync → `./gradlew bundleRelease`.
3. Semnează AAB cu keystore-ul din secretele repo.
4. Deduce `versionCode` din tag: `MAJOR*10_000 + MINOR*100 + PATCH`.
5. Uploadează AAB în Google Play pe track-ul ales (default: `internal`, status `draft`).
6. Salvează AAB și ca artefact GitHub (30 zile) pentru inspecție/QA.

## Secrete GitHub necesare (Repo Settings → Secrets and variables → Actions)

Toate sub environment-ul `production` (protejat cu review manual):

### Build web
| Secret | Sursă |
|---|---|
| `VITE_SUPABASE_URL` | din `.env` local |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | din `.env` local |
| `VITE_SUPABASE_PROJECT_ID` | din `.env` local |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile dashboard |

### Signing Android
| Secret | Cum îl obții |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w 0 ventuza-release.keystore \| pbcopy` |
| `ANDROID_KEYSTORE_PASSWORD` | parola din pasul de generare `keytool` |
| `ANDROID_KEY_ALIAS` | ex: `ventuza` |
| `ANDROID_KEY_PASSWORD` | parola alias-ului |

### Google Play API
| Secret | Cum îl obții |
|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON` | JSON complet al contului de serviciu (vezi mai jos) |

## Setup Google Play Service Account (o singură dată)

1. **Play Console → Setup → API access** → Link a Google Cloud project → creează
   proiect nou dacă nu ai.
2. **Google Cloud Console → IAM → Service Accounts** → Create service account.
   - Nume: `play-publisher-ci`.
   - Nu îi acorda roluri Google Cloud (nu are nevoie).
3. La service account → **Keys → Add key → JSON** → descarcă `key.json`.
4. Înapoi în **Play Console → API access** → găsește contul creat →
   **Grant access**. Permisiuni minime:
   - **Releases → Manage production and testing tracks**: ✅
   - **App access → View app information**: ✅
   - Restul: nu.
5. **Aplicație Play**: adaugă contul la app-ul `app.ventuza.mobile` (dacă nu e
   automat prin org).
6. Salvează conținutul integral al `key.json` (inclusiv acolade) în secretul
   GitHub `PLAY_SERVICE_ACCOUNT_JSON`.

## Setup keystore (o singură dată)

```bash
keytool -genkey -v -keystore ventuza-release.keystore \
  -alias ventuza -keyalg RSA -keysize 4096 -validity 10000
# Salvează keystore-ul și parolele în 1Password / Bitwarden (backup permanent).
base64 -w 0 ventuza-release.keystore > keystore.b64
# Copiază conținutul în secretul GitHub ANDROID_KEYSTORE_BASE64.
```

⚠️ **Nu pierde keystore-ul.** Fără el nu mai poți urca update-uri sub
`app.ventuza.mobile`. Google Play App Signing (recomandat la prima urcare
manuală în Console) reduce riscul: cheia de upload poate fi rotită dacă e
compromisă.

## Publicare unei versiuni noi

```bash
# 1. Bump versiune (nu editezi build.gradle; workflow-ul o face din tag)
git tag v1.2.3
git push origin v1.2.3
```

Workflow-ul urcă automat pe track `internal` ca `draft`. Verifici în Play
Console și promovezi manual către closed/production când vrei să trimiți la
review.

Pentru release direct pe alt track (când tag-ul e deja urcat sau vrei manual):

```
GitHub → Actions → Android Release → Run workflow
  track: production
  release_status: draft
```

## Whats-new (schimbări per limbă)

Editează `fastlane/metadata/android/{ro-RO,en-US}/changelogs/default.txt`
înainte de push tag. Textul apare în Play Console la review.

## Prima urcare manuală (obligatorie)

Google Play NU acceptă prima urcare a unui `packageName` prin API. Deci:

1. Build local (vezi `docs/google-play-release.md`).
2. Upload manual AAB în Play Console → Internal testing → Create release.
3. Play generează cheia de app signing (păstreaz-o server-side).
4. De la a doua urcare încolo, pipeline-ul CI preia complet.

## Rollback

Dacă un release e ratat: Play Console → Release → Discard sau Halt rollout.
Codul din repo revii cu `git revert <tag-commit>` și tag nou incrementat.
