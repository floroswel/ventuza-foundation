# Incident Response Plan — Suzeta

**Operator:** VOMIX GENIUS S.R.L. (CUI 43025661)
**Persoană responsabilă (primă linie):** Florin, Administrator
**DPO:** dpo@suzeta.eu
**Escaladare externă:** consultant GDPR (contract pe retainer)
**Versiune:** 1.0.0
**Data:** 2026-07-13

> **Realitate operațională:** operatorul este solo (Florin). Planul este
> proiectat pentru o singură persoană cu escaladare rapidă la consultant
> extern. Fără procese care depind de "echipă disponibilă 24/7".

---

## 1. Clasificarea severității

| Nivel | Definiție | Timp răspuns | Notificare ANSPDCP |
|-------|-----------|--------------|---------------------|
| **P0 — Critical** | Breach date Art. 9 (HIV, orientare), CSAM confirmat, compromis credentials admin/DB, DDoS masiv care blochează accesul, expunere publică date multiple useri | ≤ 1 oră | DA (72h) + notificare user afectat |
| **P1 — High** | Breach date user (email, mesaje), zero-day exploit activ, phishing la scară, downtime > 30 min, exploit RLS confirmat | ≤ 4 ore | Da dacă afectează > 100 useri |
| **P2 — Medium** | Vulnerabilitate raportată dar nedovedit exploatată, downtime < 30 min, expunere accidentală UI (fără date scoase), rate limit ocolit | ≤ 24 ore | Nu (documentat intern) |
| **P3 — Low** | Bug non-securitate, config warning, alert linter fără exploit | ≤ 72 ore | Nu |

---

## 2. Primele 60 minute — checklist Florin

### Etapa 1: Confirmare (0-10 min)

1. **Identifică sursa alertei**: user report / Sentry / Supabase log / linter /
   security-scan / press.
2. **Confirmă că e real** (nu falsă alarmă): reproduce în preview dacă e safe;
   dacă implică date live, NU reproduce — mergi direct la Etapa 2.
3. **Notează**: timestamp, sursa, primele indicii, URL/endpoint afectat.

### Etapa 2: Containment (10-30 min)

**Dacă credentials compromise (admin, super_admin, service_role):**
```bash
# 1. Revocă sesiunile admin (Supabase Dashboard → Auth → Users → Sign out user)
# 2. Rotește parola admin + activează 2FA dacă nu era activ
# 3. Rotește SUPABASE_SERVICE_ROLE_KEY (Supabase Dashboard → Project Settings → API)
# 4. Rotește HEALTH_COL_KEY (env server) — următorul RPC va reîncerca decriptarea
# 5. Rotește orice API key third-party (Didit, RevenueCat, Resend)
```

**Dacă exploit RLS / SQL injection:**
```sql
-- Dezactivează tabela afectată temporar
REVOKE ALL ON public.<table> FROM anon, authenticated;
-- Sau kill-switch dacă e ceva ce merge prin RPC
UPDATE public.feature_flags SET enabled=false WHERE key='<affected_feature>';
```

**Dacă DDoS / abuz masiv:**
- Activează Cloudflare "Under Attack" mode (Cloudflare Dashboard).
- Crește sensibilitatea rate limiter (via `app_settings` → `discover_throttle`,
  `partner_quotas`).
- Blochează IP-uri identificate în `admin_ip_allowlist` (invers — deny list).

**Dacă CSAM confirmat:**
- Ban imediat user + soft-delete conturi (păstrează hash-uri pentru autorități).
- NU privi imaginea — folosește doar hash-ul.
- Notifică autorități RO (Direcția de Investigare a Infracțiunilor de
  Criminalitate Organizată și Terorism — DIICOT + NCMEC).

### Etapa 3: Comunicare (30-60 min)

1. **Contactează consultantul GDPR extern** (dacă P0/P1) prin email + WhatsApp
   (numere de urgență în agenda personală, NU în repo).
2. **Notează în registru intern**: `admin_audit_log` cu severitate `critical` +
   `security_incidents.log` (fișier local encrypted).
3. **Dacă P0**: pregătește notificare ANSPDCP (template §4) — trimite în 72h
   maxim de la conștientizare.

---

## 3. Notificare ANSPDCP (72h GDPR Art. 33)

**Portalul:** https://www.dataprotection.ro/ (formular oficial breach)
**Alternativ email:** anspdcp@dataprotection.ro
**Termen:** 72h de la conștientizarea breach-ului.

### Template notificare

```
Către: Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal
Subiect: Notificare încălcare securitate date personale — Art. 33 GDPR

Operator: VOMIX GENIUS S.R.L.
CUI: 43025661
Sediu: [adresa completă]
Reprezentant: Florin [nume], Administrator
DPO: dpo@suzeta.eu

1. Natura încălcării:
   [Descriere concisă: ce s-a întâmplat, când, cum a fost descoperit]

2. Categorii de date afectate:
   [Ex: email, orientare sexuală (Art. 9), mesaje 1:1]

3. Număr aproximativ persoane vizate:
   [Ex: 1,234 useri activi din baza de 15,000]

4. Consecințe probabile:
   [Ex: risc outing pentru useri LGBTQ+, risc șantaj]

5. Măsuri luate:
   - Revocare credentials compromise (timestamp)
   - Rotire chei API (timestamp)
   - Notificare useri afectați (timestamp)
   - Investigare cauză root (în curs)

6. Măsuri planificate:
   [Ex: audit extern, revizuire RLS, patch cod]

Data notificării: [ISO 8601]
Semnătură: [Florin, Administrator VOMIX GENIUS S.R.L.]
```

---

## 4. Notificare utilizatori (Art. 34)

Necesară dacă breach-ul e susceptibil să genereze **risc ridicat** pentru
drepturile persoanelor. Pentru dating LGBTQ+ cu date Art. 9, orice breach de
orientare/HIV = risc ridicat AUTOMAT.

**Canal:** email tranzacțional prin Resend (template dedicat) + notificare
in-app la primul login post-breach.

### Template email

```
Subiect: Suzeta — Notificare importantă privind securitatea contului tău

Salut,

Îți scriem pentru a te informa despre un incident de securitate care a afectat
contul tău Suzeta pe data de [YYYY-MM-DD].

CE S-A ÎNTÂMPLAT
[Descriere clară, fără jargon tehnic]

CE DATE AU FOST AFECTATE
[Listă concretă, ex: adresa ta de email + numele afișat]

CE NU A FOST AFECTAT
[Listă la fel de concretă — arată transparență]

CE AM FĂCUT
- Am oprit accesul neautorizat (timestamp)
- Am rotit toate cheile de acces
- Am solicitat resetarea parolelor pentru conturile potențial afectate

CE POȚI FACE TU
1. Schimbă parola (link direct)
2. Activează autentificare în 2 pași (link Settings → Security)
3. Verifică ultimele activități din contul tău (link Settings → Sesiuni active)

Am notificat Autoritatea Națională de Supraveghere a Prelucrării Datelor
(ANSPDCP) conform GDPR Art. 33.

Îți poți exercita oricând drepturile GDPR (Art. 15-22) contactând-ne la
dpo@suzeta.eu.

Îmi pare rău că s-a întâmplat. Ne asumăm răspunderea și îmbunătățim procesele.

Florin, Administrator Suzeta / VOMIX GENIUS S.R.L.
```

---

## 5. Post-mortem (obligatoriu pentru P0/P1, opțional P2)

Termen: 7 zile calendaristice după rezolvare. Format markdown, salvat în
`docs/postmortems/YYYY-MM-DD-<slug>.md` (dosar creat la nevoie).

Structură:
1. **TL;DR** (3 rânduri)
2. **Timeline** (UTC, minut-cu-minut)
3. **Impact** (câți useri, ce date, downtime)
4. **Root cause** (analiză 5-whys)
5. **Ce a mers bine**
6. **Ce a mers prost**
7. **Action items** (owner + deadline concret)

Publicare externă (blog / status page): la latitudinea operatorului, cu
recomandare de transparență pentru P0.

---

## 6. Contacte de urgență (nu în repo — în agenda personală)

- Consultant GDPR extern: [nume + email + telefon]
- Avocat drept IT: [nume + email + telefon]
- ANSPDCP: +40 318 059 211, anspdcp@dataprotection.ro
- DIICOT (CSAM, fraude majore): +40 21 316 5411
- ACCEPT (helpline LGBTQ+): +40 21 252 5620 (dacă incidentul afectează
  comunitatea vulnerabilă și ai nevoie de ghidaj)

---

## 7. Testare plan

**Anual**: table-top exercise. Simulează un scenariu P0 și parcurge planul cu
consultantul extern. Documentează lecțiile în `docs/postmortems/`.

Ultima testare: — (nu s-a făcut încă; primul exercițiu programat 2026-10)
