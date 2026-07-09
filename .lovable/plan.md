# Plan reparare SECURITY DEFINER — GRANT anon

**Status curent:** Migrarea `20260709014036_...sql` există deja și rezolvă cea mai mare parte. **NU e încă aplicată** — trebuie revăzută + corectată înainte, pentru că **conține 2 erori critice care sparg signup-ul și 1 lipsă potențială.**

---

## 🔴 CRITIC — 2 funcții greșit puse în „authenticated only" (sparg signup + boot)

| Funcție | Cine o apelează REAL | De ce e greșit în migrare | Verdict |
|---|---|---|---|
| **`get_country_risk(text)`** | `src/hooks/useCountryRisk.ts:55` → apelat din `<CountryRiskGuard />` montat în `__root.tsx:242` — **rulează la boot, ÎNAINTE de login**, inclusiv pe `/auth`, `/blocked-region`, `/`. | Migrarea o mută la `authenticated`. Anonimii primesc 403 → country gate se rupe → `/blocked-region` nu funcționează pentru useri neînscriși din țări restricționate. | **anon LEGITIM** — mută din bucket-ul "authenticated" în bucket-ul "anon + authenticated". |
| **`app_role_values()`** | `src/lib/__tests__/app-role-enum.test.ts` — test cu `supabase` anon client. Poate fi apelat și din UI signup pentru dropdown de rol (deși în app-ul curent nu e). | Test-ul rulează anon. Doar returnează enum values (metadata publică, zero info sensibilă). | **anon LEGITIM** (safe) sau **authenticated** dacă vrei conservator — dar sigur nu blocher. Recomand `anon + authenticated`. |

---

## 🟡 De verificat înainte de aplicare — 1 caz ambiguu

| Funcție | Situație | Verdict |
|---|---|---|
| **`didit_apply_result`** | Apelat din `src/routes/api/public/didit-webhook.ts:80` cu `supabase.rpc(...)`. Dacă în handler client-ul e `supabaseAdmin` (service_role) → OK. Dacă e client publishable anon → rupe webhook-ul. | **Verifică** că `didit-webhook.ts` folosește `supabaseAdmin`. Migrarea îl pune corect pe `service_role only`, dar handler-ul TREBUIE să folosească service_role. Am confirmat: `age-webhook.ts` la fel. Ambele HMAC-verifică semnătura, deci pot folosi service_role liniștit. Fix: `const { supabaseAdmin } = await import(...)` în handler. |

---

## Tabel complet — clasificare 48 funcții

### ADMIN (service_role only — corect în migrare ✅)
| Funcție | Rol server fn | Verdict |
|---|---|---|
| `admin_apply_strike` | `supabaseAdmin` din `admin-enforcement.functions.ts` | ✅ service_role |
| `admin_assign_alert` | `admin-enterprise.functions.ts` | ✅ service_role |
| `admin_assign_moderator` | `admin-enforcement.functions.ts` | ✅ service_role |
| `admin_grant_badge` | `admin-badges.functions.ts` | ✅ service_role |
| `admin_reveal_profile_location` | `admin-break-glass.functions.ts` | ✅ service_role |
| `admin_revoke_badge` | `admin-badges.functions.ts` — folosește `context.supabase` (authenticated) în cod! ⚠️ | ⚠️ **Vezi nota** de mai jos |
| `admin_send_official_message` | `admin-enforcement.functions.ts` | ✅ service_role |
| `admin_set_legal_hold` | `admin-enforcement.functions.ts` | ✅ service_role |
| `admin_set_temporary_ban` | `admin-enforcement.functions.ts` | ✅ service_role |

⚠️ **Notă `admin_revoke_badge`**: `src/lib/admin-badges.functions.ts:83` folosește `context.supabase.rpc("admin_revoke_badge"...)` = client authenticated cu JWT-ul admin-ului, NU `supabaseAdmin`. Dacă migrarea revocă `authenticated`, apelul din server fn eșuează. **Trebuie fie:**
- (A) modificat server fn-ul să folosească `supabaseAdmin`, sau
- (B) lăsat `authenticated` cu GRANT + funcția SQL să verifice `is_admin_or_above(auth.uid())` intern (probabil deja face).

Recomand (A) pentru consistență cu restul admin. Necesită edit în `admin-badges.functions.ts` în aceeași bucată.

### DIDIT / vârstă (service_role only — corect ✅)
| Funcție | Verdict |
|---|---|
| `didit_apply_result` | ✅ service_role (webhook HMAC) |
| `sync_age_status_from_verification` | ✅ service_role (trigger/cron) |
| `reset_stale_age_verification` | ✅ service_role (job) |
| `reset_stale_age_verifications_batch` | ✅ service_role (job) |

### DIDIT link — authenticated
| Funcție | Verdict |
|---|---|
| `didit_link_session` | ✅ authenticated (server fn `startDiditVerification` folosește `context.supabase` cu JWT user) |

### VERIFICARE internă (authenticated ✅)
| Funcție | Verdict |
|---|---|
| `assert_verification_or_limited` | ✅ authenticated (guard user-side) |
| `is_verification_staff` | ✅ authenticated (check propriul rol) |
| `verification_generate_challenges` | ✅ authenticated |
| `verification_moderator_claim` | ✅ authenticated (mod interior) |
| `verification_moderator_decide` | ✅ authenticated |
| `verification_moderator_take` | ✅ authenticated |
| `verification_submit_request` | ✅ authenticated (user submit selfie) |
| `verification_list_purgeable_paths` | ✅ service_role (purge job) |
| `verification_mark_purged` | ✅ service_role (purge job) |
| `verification_decide_invariants_snapshot` | ✅ service_role (audit) |

### CONSENT / USER (authenticated ✅ cu excepția `get_country_risk`)
| Funcție | Cine apelează | Verdict |
|---|---|---|
| `record_consent` | `use-consent.ts` client authenticated + push.functions.ts server fn | ✅ authenticated |
| `get_active_strikes` | `admin-enforcement.functions.ts` context.supabase | ✅ authenticated (RPC verifică că e propriul user sau staff) |
| `get_user_badges` | Server fn cu authenticated | ✅ authenticated |
| `get_user_badges_batch` | `badges.functions.ts` server fn authenticated | ✅ authenticated |
| `get_venue_badges` | Similar | ✅ authenticated |
| `get_venue_badges_batch` | Similar | ✅ authenticated |
| **`get_country_risk`** | **`useCountryRisk` anon la boot** | 🔴 **anon + authenticated** |
| `get_message_location_bucket` | `chat.ts` client authenticated | ✅ authenticated |
| `is_profile_publicly_visible` | RLS helper / server-side | ✅ authenticated (poate fi și anon dacă e folosit în policies publice — verificat: e folosit intern în RLS, deci nu contează cine îl are; recomand authenticated) |
| `safe_message_row` | RLS helper mesaje | ✅ authenticated |
| `send_location_message` | `chat.ts` client authenticated | ✅ authenticated |
| `update_live_location_message` | `chat.ts` client authenticated | ✅ authenticated |

### EMAIL QUEUE (service_role only ✅)
| Funcție | Verdict |
|---|---|
| `enqueue_email` | ✅ service_role (`webhook.ts`, `partner-broadcasts.functions.ts` folosesc `supabaseAdmin`) |
| `delete_email` | ✅ service_role |
| `read_email_batch` | ✅ service_role |
| `move_to_dlq` | ✅ service_role |
| `email_queue_dispatch` | ✅ service_role (cron/pg_cron) |
| `email_queue_wake` | ✅ service_role |

### DIVERSE
| Funcție | Verdict | De ce |
|---|---|---|
| `app_role_values` | 🟡 **anon + authenticated** | Enum values publice, folosit în test anon. Nu e sensibil. |
| `security_invariants_snapshot` | ✅ service_role | Audit tool, apelat de cron/admin |
| `sync_partner_announcements_consent` | ✅ service_role | Backfill/trigger helper |
| `tg_notify_new_like` | ✅ service_role (sau REVOKE ALL) | Este trigger function — nu se apelează direct din client. Safe să fie doar service_role. |
| `st_estimatedextent` | — | PostGIS extension, IGNORE |

---

## Modificări față de migrarea actuală

**Migrarea existentă `20260709014036_...sql` trebuie MODIFICATĂ în 3 locuri înainte de aplicare:**

1. **Scoate `get_country_risk(text)` din bucket-ul "authenticated only"** și adaugă un al treilea bloc pentru "anon + authenticated".
2. **Scoate `app_role_values()`** din bucket-ul "authenticated only" și mut-o în bucket-ul "anon + authenticated" (defensiv — safe metadata).
3. **`admin_revoke_badge`** — rămâne `service_role only` în migrare, DAR trebuie modificat `src/lib/admin-badges.functions.ts` să folosească `supabaseAdmin` în loc de `context.supabase`. (Consistent cu restul funcțiilor admin.)

---

## Migrarea DRAFT propusă (nu aplicată)

Înlocuiește complet fișierul `supabase/migrations/20260709014036_...sql` cu:

```sql
-- Fix: SECURITY DEFINER functions with EXECUTE granted to anon.
-- Three buckets: service_role only / authenticated only / anon + authenticated.

-- === BUCKET 1: service_role only (admin + jobs + webhooks) ===
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'admin_apply_strike(uuid, text, text, integer)',
    'admin_assign_alert(bigint, uuid, timestamp with time zone)',
    'admin_assign_moderator(text, uuid, uuid)',
    'admin_grant_badge(uuid, text, timestamp with time zone, text)',
    'admin_reveal_profile_location(uuid)',
    'admin_revoke_badge(uuid, text, text)',
    'admin_send_official_message(uuid, text, text)',
    'admin_set_legal_hold(uuid, boolean, text)',
    'admin_set_temporary_ban(uuid, timestamp with time zone, text)',
    'didit_apply_result(text, text, text, integer, jsonb)',
    'sync_age_status_from_verification()',
    'reset_stale_age_verification(uuid)',
    'reset_stale_age_verifications_batch()',
    'security_invariants_snapshot()',
    'sync_partner_announcements_consent()',
    'verification_decide_invariants_snapshot()',
    'verification_list_purgeable_paths()',
    'verification_mark_purged(uuid[])',
    'tg_notify_new_like()',
    'enqueue_email(text, jsonb)',
    'delete_email(text, bigint)',
    'read_email_batch(text, integer, integer)',
    'email_queue_dispatch()',
    'email_queue_wake()',
    'move_to_dlq(text, text, bigint, jsonb)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;

-- === BUCKET 2: authenticated only (RPC-uri user-side) ===
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'assert_verification_or_limited()',
    'is_verification_staff(uuid)',
    'record_consent(text, text, boolean, text)',
    'get_active_strikes(uuid)',
    'get_user_badges(uuid)',
    'get_user_badges_batch(uuid[])',
    'get_venue_badges(uuid)',
    'get_venue_badges_batch(uuid[])',
    'get_message_location_bucket(uuid)',
    'is_profile_publicly_visible(uuid, uuid)',
    'safe_message_row(uuid)',
    'send_location_message(uuid, double precision, double precision, text)',
    'update_live_location_message(uuid, double precision, double precision)',
    'verification_generate_challenges()',
    'verification_moderator_claim()',
    'verification_moderator_decide(uuid, text, text, text, text)',
    'verification_moderator_take(uuid)',
    'verification_submit_request(jsonb, text[], text, text, text)',
    'didit_link_session(text, text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;

-- === BUCKET 3: anon LEGITIM (chemate înainte de login) ===
-- get_country_risk: apelat din useCountryRisk în __root.tsx la boot,
--                   inclusiv pe /auth și /blocked-region.
-- app_role_values : returnează doar enum values (metadata publică, safe).
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'get_country_risk(text)',
    'app_role_values()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn);
  END LOOP;
END $$;
```

---

## Ordinea de execuție (după aprobarea ta)

1. **Modific `src/lib/admin-badges.functions.ts`** — schimb `context.supabase.rpc("admin_revoke_badge"...)` → `supabaseAdmin.rpc(...)` (paritate cu `admin_grant_badge`).
2. **Rescriu migrarea** cu cele 3 bucket-uri de mai sus.
3. **Rulez migrarea.**
4. **Verific:**
   - `supabase.rpc('get_country_risk',{_country_code:'US'})` anon → returnează rând.
   - `supabase.rpc('admin_apply_strike',...)` anon → refuză cu permission denied.
   - Boot app fără login → country guard funcționează.
   - Admin panel → badge grant/revoke funcționează.

Aștept aprobarea ta să trec în build mode și să aplic.
