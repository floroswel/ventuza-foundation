-- Notificarea de Like: numele și profilul celui care a dat Like.
--
-- DE CE: `tg_notify_new_like` scria un titlu anonim („Cuiva îi place de tine”)
-- și `link = '/discover'`, deci destinatarul nu putea nici să vadă cine, nici
-- să ajungă la profil. Cerința produsului este acum „[Nume] ți-a dat Like”, cu
-- avatar, și tap → profilul expeditorului.
--
-- CE AFECTEAZĂ: doar funcția `public.tg_notify_new_like()` (titlu/body/link) și
-- adaugă `public.get_notification_actors()`. Nicio schimbare de schemă, niciun
-- rând atins, nicio politică RLS modificată. Notificările deja existente rămân
-- exact cum sunt — backward-compatible, fără pierdere de date.

-- 1) Like → numele expeditorului + link către profilul lui.
CREATE OR REPLACE FUNCTION public.tg_notify_new_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  reciprocal boolean;
  _name text;
  _slug text;
BEGIN
  IF NEW.action NOT IN ('like', 'super') THEN RETURN NEW; END IF;
  IF NEW.swiper_id = NEW.target_id THEN RETURN NEW; END IF;

  -- Like reciproc → există deja notificare de Match. O singură notificare
  -- pentru un singur eveniment.
  SELECT EXISTS(
    SELECT 1 FROM public.matches
    WHERE (user_a = NEW.swiper_id AND user_b = NEW.target_id)
       OR (user_a = NEW.target_id AND user_b = NEW.swiper_id)
  ) INTO reciprocal;
  IF reciprocal THEN RETURN NEW; END IF;

  SELECT display_name, profile_slug INTO _name, _slug
  FROM public.profiles WHERE id = NEW.swiper_id;

  PERFORM public.notify_user(
    NEW.target_id,
    NEW.swiper_id,
    'like'::public.notification_type,
    COALESCE(_name, 'Cineva') || ' ți-a dat Like ❤️',
    NULL,
    -- Ruta publică existentă. Fără slug (profil incomplet) rămâne /discover:
    -- nu inventăm o rută paralelă și nu ocolim protecțiile din /u/:slug.
    CASE WHEN _slug IS NOT NULL THEN '/u/' || _slug ELSE '/discover' END,
    NEW.id
  );
  RETURN NEW;
END; $function$;

-- 2) Avatarele actorilor din clopoțel.
--
-- RLS pe `profiles` permite doar `auth.uid() = id`, deci clientul nu poate citi
-- direct numele/poza altui utilizator — corect. Funcția de mai jos expune strict
-- minimul necesar randării listei de notificări și NU poate fi folosită ca să
-- enumeri profiluri: întoarce doar actori care apar deja într-o notificare a
-- apelantului.
--
-- Aceleași garduri ca `get_profile_by_slug`: șters, banat, suspendat, block
-- bilateral. Un profil blocat nu întoarce nimic — rândul rămâne cu iconița
-- generică, fără cale de acces la profil.
CREATE OR REPLACE FUNCTION public.get_notification_actors(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, photo text, profile_slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    -- Doar prima poză: avatar, nu galerie.
    CASE WHEN array_length(p.photos, 1) > 0 THEN p.photos[1] ELSE NULL END,
    p.profile_slug
  FROM public.profiles AS p
  WHERE p.id = ANY(_ids)
    AND EXISTS (
      SELECT 1 FROM public.notifications AS n
      WHERE n.user_id = auth.uid() AND n.actor_id = p.id
    )
    AND p.deleted_at IS NULL
    AND (p.banned_at IS NULL OR p.banned_at > now())
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks AS b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_notification_actors(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_actors(uuid[]) TO authenticated;
