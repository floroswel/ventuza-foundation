Raportul de verificare Play Store a fost livrat integral în chat. Nu propun modificări acum — aștept confirmarea ta pentru a decide direcția.

## Ce am confirmat
- `/account-deletion` și `/legal/privacy` — rute LIVE, gata de introdus în Play Console.
- Toate item-urile Android (targetSdk, keystore, versionCode) sunt manuale local — nu ating repo-ul.

## Singura decizie de cod deschisă
Country gating are infrastructură completă (tabel + RPC + hook + seed 11 țări) dar zero enforcement în UI. Sunt trei opțiuni și vreau confirmarea ta:

**Opțiunea A — Conectare completă înainte de submisie** (recomandat, ~1h de lucru):
- Consum `useCountryRisk` în `SessionGuards` → redirect la o pagină `/blocked-region` pentru țări cu `disable_signup=true`.
- Ascund `/discover` și trec profilul pe stealth automat când `disable_discover=true` / `force_stealth=true`.
- Ridic bucket-ul minim de distanță când `hide_precise_location=true`.
- Banner discret + link `/safety` în țările `elevated`/`high`.

**Opțiunea B — Doar signup block** (30 min):
- Doar `disable_signup` respectat (UG/SA/IR blocate la înregistrare).
- Restul rămân „decorativ" până la o iterație următoare.

**Opțiunea C — Amân, public fără gating**:
- Risc legal pentru useri din Iran/Uganda/Arabia dacă instalează app-ul.
- Acceptabil doar dacă geo-restricționezi distribuția în Play Console la nivel de țară (opțiune în consolă).

Spune-mi A / B / C și trec în build mode să execut.
