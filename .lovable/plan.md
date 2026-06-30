# Plan: reparare 2 vulnerabilități găsite la verificarea finală anti-bot

Două migrări SQL + două edit-uri TS minore. Zero impact UX pentru userii legitimi. Restaurează garanții deja documentate în AGENTS.md („RATE LIMIT DISCOVER" și „BLOCK BILATERAL ENFORCED LA DB") care în prezent sunt încălcate la nivelul DB.

## Fix #1 — `discover_profiles`: un singur overload, fără hiv_filter, cu rate-limit

**Migrare SQL**
- Inspecție prealabilă: `SELECT oid, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname='discover_profiles'` ca să am semnătura exactă a celor 2 overload-uri.
- `DROP FUNCTION public.discover_profiles(<args vechi cu hiv_filter>)`.
- Rămâne în DB doar overload-ul B (`_viewer uuid, _max_km int, _limit int, _offset int, _genders text[], _tribes text[], _min_age int, _max_age int, _online_only boolean`), cel cu `INSERT INTO public.rate_limit_log` + cap 50.
- `REVOKE EXECUTE … FROM anon, PUBLIC; GRANT EXECUTE … TO authenticated`.

**Edit TS — `src/lib/discover.ts`**
- `fetchDiscover` rescris să apeleze noua semnătură: `supabase.rpc('discover_profiles', { _viewer, _max_km, _limit, _offset, _genders, _tribes, _min_age, _max_age, _online_only })`.
- Eliminat orice referință la `hiv_filter` din payload, tipuri locale și UI de filtre Discover.
- Mapare eroare `discover_rate_limited` (ERRCODE 53400) → mesaj RO existent în `auth-errors.ts` / `discover.ts`.

**Edit test — `src/lib/__tests__/security-invariants.test.ts`**
- Assertion nouă: `SELECT count(*) FROM pg_proc WHERE proname='discover_profiles'` trebuie să fie `1`.
- Assertion existentă pe rate-limit rămâne neschimbată.

**Impact user**: zero pentru flux normal. Filtrul HIV (dacă apărea în UI) dispare — conform Art. 9.

## Fix #2 — Block bilateral enforced la DB

**Inspecție prealabilă**
- `\d public.blocks` ca să confirm numele coloanelor (probabil `blocker_id` / `blocked_id`).
- `\d public.messages` pentru `sender_id` / `recipient_id`.

**Migrare SQL** (un singur fișier):

```text
1. CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid)
   RETURNS boolean
   LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
     SELECT EXISTS (
       SELECT 1 FROM public.blocks
       WHERE (blocker_id = a AND blocked_id = b)
          OR (blocker_id = b AND blocked_id = a)
     )
   $$;

2. CREATE OR REPLACE FUNCTION public.list_my_block_relations()
   RETURNS TABLE(other_user_id uuid, direction text)
   LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
     SELECT blocked_id, 'outgoing'::text FROM public.blocks WHERE blocker_id = auth.uid()
     UNION ALL
     SELECT blocker_id, 'incoming'::text FROM public.blocks WHERE blocked_id = auth.uid()
   $$;

3. CREATE OR REPLACE FUNCTION public.prevent_message_when_blocked()
   RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
   BEGIN
     IF public.is_blocked_between(NEW.sender_id, NEW.recipient_id) THEN
       RAISE EXCEPTION 'blocked_recipient' USING ERRCODE='42501';
     END IF;
     RETURN NEW;
   END $$;

   CREATE TRIGGER trg_prevent_message_when_blocked
     BEFORE INSERT ON public.messages
     FOR EACH ROW EXECUTE FUNCTION public.prevent_message_when_blocked();

4. REVOKE EXECUTE ON FUNCTION public.is_blocked_between(uuid,uuid)
     FROM anon, PUBLIC;
   GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid,uuid)
     TO authenticated, service_role;
   REVOKE EXECUTE ON FUNCTION public.list_my_block_relations()
     FROM anon, PUBLIC;
   GRANT EXECUTE ON FUNCTION public.list_my_block_relations()
     TO authenticated, service_role;
```

**Edit TS — `src/lib/chat.ts`**
- Apelurile RPC rămân la fel (funcțiile vor exista acum).
- Map eroare `blocked_recipient` la trimitere mesaj → toast RO: „Nu poți trimite mesaj acestui utilizator."

**Impact user**:
- Useri fără blocaje: zero diferență.
- Useri cu blocaje active: composer-ul se dezactivează corect, mesajele nu mai ajung la destinație nici dacă cineva încearcă forțare RPC directă.

## Ordine execuție

1. Inspectez `pg_proc` și `\d` pe tabele pentru a confirma semnături/coloane exacte.
2. Migrare #1 (drop overload discover) — necesită aprobare în UI.
3. Edit TS `src/lib/discover.ts` + test.
4. Migrare #2 (block functions + trigger) — necesită aprobare.
5. Edit TS `src/lib/chat.ts` + mapare eroare în `auth-errors.ts`/echivalent.
6. `tsgo --noEmit` curat + rulare `security-invariants` test.

## Out of scope (rămân ne-cod)
- Setare `VITE_TURNSTILE_SITE_KEY` — dacă mi-l dai, îl pun în secrets în același sprint.
- Programare `cleanup_rate_limit_log()` în pg_cron — pot adăuga în migrarea #2 dacă vrei.
- `.aab` + Google Play Data Safety — nu se face din cod.

## Verificare după aplicare
- `pg_proc` întoarce 1 rând pentru `discover_profiles`.
- `pg_trigger` confirmă `trg_prevent_message_when_blocked` activ pe `messages`.
- Test manual: A blochează B → B trimite mesaj → eroare `blocked_recipient` → toast RO.
- Test manual: Discover paginat normal; al 11-lea apel într-o oră → `discover_rate_limited`.
- `tsgo --noEmit` curat; `security-invariants` test verde.
