-- 1. Boolean helper: cont utilizabil (18+ verificat, email confirmat, nebanat)
CREATE OR REPLACE FUNCTION public.is_account_usable()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assert_account_usable();
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_account_usable() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_usable() TO authenticated, service_role;

-- 2. Conținutul mesajelor NU se poate citi fără verificare 18+
DROP POLICY IF EXISTS "Participants read messages" ON public.messages;
CREATE POLICY "Participants read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_participant(conversation_id, auth.uid())
    AND public.is_account_usable()
  );

-- 3. Link public personalizat
CREATE OR REPLACE FUNCTION public.set_my_profile_link(_slug text)
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_slug text := lower(trim(coalesce(_slug, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_slug !~ '^[a-z0-9][a-z0-9._-]{1,22}[a-z0-9]$' THEN
    RAISE EXCEPTION 'slug_invalid' USING ERRCODE = '22023';
  END IF;
  IF v_slug ~ '^(admin|api|app|auth|settings|account|profile|verify|legal|safety|messages|discover|nearby|events|groups|partner|business|invite|premium|wallet|quests|support|help|about|contact|u|me|root|suzeta|www|blocked|blocked-region|notifications|favorites|visitors|matches|cruise|explore|status|advertise|offers|venues)$' THEN
    RAISE EXCEPTION 'slug_reserved' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(profile_slug) = v_slug AND id <> v_uid) THEN
    RAISE EXCEPTION 'slug_taken' USING ERRCODE = '23505';
  END IF;

  UPDATE public.profiles SET profile_slug = v_slug WHERE id = v_uid;
  RETURN v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_profile_link(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_profile_link(text) TO authenticated;

-- 4. Trigger: regenerează slug-urile auto ("user-b555") când apare un nume real
CREATE OR REPLACE FUNCTION public.ensure_profile_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; candidate text; i int := 0;
BEGIN
  IF NEW.profile_slug IS NOT NULL
     AND NEW.profile_slug <> ''
     AND NEW.profile_slug !~ '^user(-[0-9a-f]{4,})?$' THEN
    RETURN NEW;
  END IF;

  base := lower(regexp_replace(coalesce(NEW.display_name, 'user'), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  IF base = '' OR base IS NULL THEN base := 'user'; END IF;
  base := left(base, 20);
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(profile_slug) = candidate AND id <> NEW.id) LOOP
    i := i + 1;
    candidate := base || '-' || substr(md5(random()::text), 1, 4);
    IF i > 10 THEN candidate := base || '-' || replace(NEW.id::text, '-', ''); EXIT; END IF;
  END LOOP;
  NEW.profile_slug := candidate;
  RETURN NEW;
END $$;

-- 5. Backfill: slug-uri auto pentru profiluri care au deja nume afișat
UPDATE public.profiles
   SET display_name = display_name
 WHERE profile_slug ~ '^user(-[0-9a-f]{4,})?$'
   AND display_name IS NOT NULL
   AND display_name <> ''
   AND deleted_at IS NULL;