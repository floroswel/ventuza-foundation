# Prompturi pentru Lovable — după remedierea din 28 august 2026

Se copiază integral, unul câte unul. Fiecare este autonom: Lovable nu are
contextul conversației în care au fost făcute modificările.

**Ordinea contează.** Nu sări peste prompt 0.

---

## Ce NU poate face Lovable — trebuie să faci tu

Două lucruri nu sunt cod, deci niciun prompt nu le rezolvă:

### 1. Secretul pentru emailuri (URGENT)

Fără el, confirmările de cont și resetările de parolă **nu pleacă**. Aplicația
refuză intenționat să trimită emailuri neverificate — altfel oricine ar putea
trimite mesaje în numele domeniului tău.

- În Supabase → Authentication → Hooks → Send Email Hook, copiază secretul
  (începe cu `v1,whsec_...`).
- Adaugă-l ca secret pe server cu numele exact `LOVABLE_WEBHOOK_SECRET`.

### 2. Vizibilitatea repository-ului

`github.com/floroswel/ventuza-foundation` este **public** — oricine citește tot
codul, inclusiv regulile de securitate ale bazei de date. Dacă vrei privat:
GitHub → Settings → General → Danger Zone → Change visibility.

---

## Prompt 0 — Protejează arhitectura nouă

**De rulat PRIMUL, o singură dată.** Lovable comite continuu; fără acest
context poate desface din greșeală reparațiile.

```
Context permanent despre acest proiect. Nu modifica nimic acum — doar
înregistrează și respectă de aici înainte.

NOTIFICĂRILE PUSH SUNT TRIMISE DE BAZA DE DATE, NU DE CLIENT.

Cum funcționează:
1. INSERT în `messages` → trigger `tg_notify_new_message`
2. Trigger-ul apelează `enqueue_push()` → scrie un rând în `push_outbox`,
   în ACEEAȘI tranzacție cu mesajul
3. Livrarea: `kick_push_dispatch()` cheamă
   /api/public/cron/push-dispatch prin pg_net (rapid), iar pg_cron îl mai
   cheamă o dată pe minut (plasă de siguranță)
4. Endpoint-ul rezervă un lot cu `claim_push_outbox()` și livrează prin
   `dispatchPush` din src/lib/push-dispatch.server.ts

De ce este așa: înainte, push-ul pleca de pe telefonul EXPEDITORULUI. Dacă
acesta bloca ecranul imediat după trimitere, Android suspenda procesul și
notificarea nu mai pleca niciodată. Utilizatorii nu primeau notificări cu
aplicația închisă.

REGULI pe care nu le încălca:
- Nu muta livrarea push înapoi în client.
- Nu duplica logica din `dispatchPush` — este UNICA implementare a
  politicii de confidențialitate (master_push, categorii, ore de liniște,
  mod discret, gate de preview). Orice cale nouă de notificare o apelează.
- Corpul notificării push este MEREU generic („Ai un mesaj nou").
  Conținutul mesajului nu ajunge niciodată într-o notificare, pentru că
  apare pe ecranul blocat. `show_preview` guvernează doar ecranele din
  aplicație.
- `net.http_post` apelează DOAR https://suzeta.app direct. Orice alt
  domeniu redirectează, iar la redirect cross-host se pierde header-ul
  Authorization → 401 tăcut.
- `.env` are voie să conțină exclusiv valori publice.
  `scripts/check-env-safety.mjs` blochează build-ul altfel. Nu-l dezactiva
  și nu adăuga chei în allowlist decât dacă sunt cu adevărat publice.

Confirmă că ai înțeles, fără să schimbi cod.
```

---

## Prompt 1 — Verifică dacă migrațiile au ajuns în baza de date

**De rulat al doilea.** Până nu știi răspunsul, nu rula prompt 2.

```
Verifică dacă migrațiile din 28 august 2026 au fost aplicate pe baza de
date de producție. Rulează în SQL și arată-mi rezultatele brute:

-- 1. Există coada de notificări?
select to_regclass('public.push_outbox') as tabela_exista;

-- 2. Ce s-a întâmplat cu notificările programate?
select status, count(*), max(created_at) as ultima
  from public.push_outbox group by status;

-- 3. Rulează cron-urile?
select jobname, schedule, active from cron.job
 where jobname in ('push-dispatch-drain','push-outbox-prune','didit-reconcile');

-- 4. Ce răspund apelurile HTTP din baza de date?
select status_code, count(*), max(created) as ultima
  from net._http_response
 where created > now() - interval '2 hours'
 group by status_code order by 3 desc;

-- 5. Insignele nu mai sunt publice?
select has_function_privilege('anon','public.get_user_badges(uuid)','execute')
       as anon_mai_are_acces;

Interpretare:
- (1) NULL → migrațiile NU s-au aplicat. Spune-mi cum le aplic.
- (2) rânduri `done` cu delivered > 0 → notificările server-side merg.
- (2) rânduri `pending` care se adună → livrarea nu pornește.
- (4) coduri 401 sau 307 → apelurile interne sunt respinse.
- (5) `true` → revocarea nu s-a aplicat.

Nu repara nimic încă. Doar raportează.
```

---

## Prompt 2 — Șterge plasa de siguranță

**Rulează DOAR dacă prompt 1 a arătat rânduri `done` cu `delivered > 0`.**
Altfel rămâi fără notificări.

```
Notificările push server-side sunt confirmate ca funcționale (`push_outbox`
are rânduri `done` cu delivered > 0).

Șterge calea temporară din client, care exista doar ca plasă de siguranță
până se confirmă că baza de date livrează:

1. src/lib/chat.ts → elimină funcția `pushNewMessageNotification` și cele
   TREI apeluri `void pushNewMessageNotification(conversationId)`
2. src/lib/push.functions.ts → elimină `sendMessagePush` și
   `MessagePushInput`
3. Actualizează testele care mai referă `sendMessagePush`:
   - src/lib/__tests__/notification-privacy.test.ts
   - src/lib/__tests__/notification-payload-regression.test.ts
   Garanția rămâne aceeași, dar se verifică în SQL: trigger-ul
   `tg_notify_new_message` din migrația
   20260828121000_push_outbox_server_side_dispatch.sql programează push-ul
   cu corpul generic 'Ai un mesaj nou', nu cu NEW.body.

NU atinge:
- src/lib/push-dispatch.server.ts
- src/routes/api/public/cron/push-dispatch.ts
- `sendPushToUser` (îl folosesc taps, like-uri, match-uri)

După modificare rulează `bun run typecheck` și `bun run test` și arată-mi
rezultatele.
```

---

## Prompt 3 — Pachetul principal e peste buget

Nu e urgent, dar poarta `bundle-size` e roșie pe fiecare commit de zile bune.

```
Workflow-ul `bundle-size` pică pe fiecare commit. Pachetul principal
(`index-*.js`) este ~182 KB gzip, față de bugetul de 175 KB din
scripts/check-bundle-size.mjs.

NU ridica bugetul. Găsește ce se încarcă la pornire fără să fie necesar.

Începe cu importurile eager din src/routes/__root.tsx. Candidați probabili
— componente care apar condiționat, nu la primul cadru:
  CookieBanner, TravelWarning, UpdateAvailableBanner

ATENȚIE, nu face lazy următoarele: AgeGate, PinLockGate, CountryRiskGuard,
SessionGuards. Sunt porți de siguranță și conformitate; dacă se încarcă
târziu, conținutul poate apărea o clipă înaintea lor.

Pentru fiecare mutare, arată-mi câți KB gzip s-au economisit, măsurat cu
`node scripts/check-bundle-size.mjs`.

Verificare obligatorie la final: `bun run typecheck`, `bun run test`, și
suita e2e trebuie să rămână verde. O încercare anterioară de a face lazy
persisterul de cache a coincis cu o picare e2e și a fost anulată — patru
teste e2e ating persistența, deci fii atent la orice schimbă momentul
încărcării.
```

---

## Prompt 4 — Alertare (opțional, dar recomandat)

Astăzi nimeni nu ar afla dacă notificările s-ar opri trei zile.

```
Adaugă alertare minimă pentru lucrurile care pot ceda tăcut. Nu construi
un sistem de monitorizare — vreau doar să aflu înainte de utilizatori.

Trei semnale, verificate de un cron care îmi trimite email dacă e ceva:

1. `push_outbox` are peste 50 de rânduri `pending` mai vechi de 10 minute
   → livrarea notificărilor s-a oprit
2. `net._http_response` are coduri != 200 în ultima oră pentru URL-uri
   suzeta.app → apelurile interne sunt respinse
3. ruta /api/public/signup-guard răspunde cu `degraded: true`
   → protecția anti-bot la înscriere nu rulează

Folosește tiparul existent: funcție SQL SECURITY DEFINER + pg_cron, cu
tokenul din `app_settings.cron_internal`, exact ca `cron_didit_reconcile`.
Emailul pleacă prin `sendTemplateEmail` din
src/lib/email-templates/send-email.ts.

Trimite maximum un email pe zi per tip de alertă, ca să nu devină zgomot
pe care îl ignor.
```
