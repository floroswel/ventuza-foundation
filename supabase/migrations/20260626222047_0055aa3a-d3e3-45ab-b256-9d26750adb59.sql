
-- Fix discover_profiles: column p.hiv_status nu mai există (a fost migrată în hiv_status_enc
-- bytea, accesibilă DOAR via RPC server-side cu cheie). În același timp, conform regulilor
-- permanente din AGENTS.md (LOCAȚIE, CIFRARE DATE SĂNĂTATE, ORIENTARE / IDENTITATE Art. 9),
-- discover NU expune brut: hiv_status, orientation, gender, pronouns către alți useri.
-- Returnăm NULL pe coloanele Art. 9 ca să păstrăm signature-ul (UI tipat) fără leak.
-- `hiv_filter` rămâne în signature pentru compat client, dar este IGNORAT.

CREATE OR REPLACE FUNCTION public.discover_profiles(
  max_distance_km integer DEFAULT 100,
  min_age integer DEFAULT 18,
  max_age integer DEFAULT 99,
  looking_for_filter text[] DEFAULT NULL::text[],
  gender_filter text[] DEFAULT NULL::text[],
  orientation_filter text[] DEFAULT NULL::text[],
  tribes_filter text[] DEFAULT NULL::text[],
  body_filter text[] DEFAULT NULL::text[],
  position_filter text[] DEFAULT NULL::text[],
  hiv_filter text[] DEFAULT NULL::text[],
  min_height integer DEFAULT NULL::integer,
  max_height integer DEFAULT NULL::integer,
  online_only boolean DEFAULT false,
  with_photo_only boolean DEFAULT false,
  verified_only boolean DEFAULT false,
  order_mode text DEFAULT 'score'::text,
  result_limit integer DEFAULT 60,
  looking_now_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, display_name text, birthdate date, gender text[], pronouns text[],
  orientation text[], looking_for text[], interests text[], bio text, prompts jsonb,
  photos text[], last_seen timestamp with time zone, tribes text[], body_type text,
  height_cm integer, weight_kg integer, ethnicity text, "position" text,
  relationship_status text, verified boolean, distance_m double precision,
  score double precision, boost_until timestamp with time zone, travel_city text,
  travel_until timestamp with time zone, looking_now_until timestamp with time zone,
  looking_now_intent text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE me public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO me FROM public.profiles pr WHERE pr.id = auth.uid();
  IF me.id IS NULL THEN RAISE EXCEPTION 'no profile'; END IF;
  IF me.suspended_until IS NOT NULL AND me.suspended_until > now() THEN
    RAISE EXCEPTION 'account suspended until %', me.suspended_until;
  END IF;

  -- hiv_filter este IGNORAT intenționat (date Art. 9 cifrate, nu se filtrează în discover)
  PERFORM hiv_filter;

  RETURN QUERY
  SELECT p.id, p.display_name,
         CASE WHEN p.hide_age THEN NULL ELSE p.birthdate END,
         -- Art. 9 leak fix: NU returnăm brut gender / pronouns / orientation
         NULL::text[] AS gender,
         NULL::text[] AS pronouns,
         NULL::text[] AS orientation,
         p.looking_for, p.interests, p.bio, p.prompts, p.photos,
         CASE WHEN p.hide_online THEN NULL ELSE p.last_seen END,
         p.tribes, p.body_type, p.height_cm, p.weight_kg, p.ethnicity, p."position",
         p.relationship_status,
         (p.verified_at IS NOT NULL),
         CASE WHEN p.hide_distance THEN NULL
              WHEN me.location IS NOT NULL AND p.location IS NOT NULL
              THEN public.bucket_distance_m(ST_Distance(me.location, p.location)) ELSE NULL END,
         (
           CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
                THEN GREATEST(0, 1 - (ST_Distance(me.location, p.location) / (max_distance_km * 1000.0)))
                ELSE 0 END
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(me.interests))),0)*0.15
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.looking_for) INTERSECT SELECT unnest(me.looking_for))),0)*0.25
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.tribes) INTERSECT SELECT unnest(me.tribes))),0)*0.30
           + CASE WHEN p.verified_at IS NOT NULL THEN 0.15 ELSE 0 END
           + CASE WHEN (now() - p.last_seen) < interval '5 minutes' AND NOT p.hide_online THEN 0.20 ELSE 0 END
           + CASE WHEN p.looking_now_until IS NOT NULL AND p.looking_now_until > now() THEN 0.40 ELSE 0 END
           - CASE WHEN p.risk_score >= 50 THEN (p.risk_score::float / 100.0) ELSE 0 END
         ),
         p.boost_until, p.travel_city, p.travel_until,
         p.looking_now_until, p.looking_now_intent
  FROM public.profiles p
  WHERE p.id <> me.id
    AND p.onboarding_completed = true
    AND COALESCE(p.incognito,false) = false
    AND (p.suspended_until IS NULL OR p.suspended_until <= now())
    AND p.banned_at IS NULL
    AND COALESCE(p.risk_score,0) < 80
    AND p.birthdate IS NOT NULL
    AND date_part('year', age(p.birthdate))::int BETWEEN min_age AND max_age
    AND (looking_for_filter IS NULL OR p.looking_for && looking_for_filter)
    AND (gender_filter IS NULL OR p.gender && gender_filter)
    AND (orientation_filter IS NULL OR p.orientation && orientation_filter)
    AND (tribes_filter IS NULL OR p.tribes && tribes_filter)
    AND (body_filter IS NULL OR p.body_type = ANY(body_filter))
    AND (position_filter IS NULL OR p."position" = ANY(position_filter))
    -- hiv_filter eliminat: coloana e cifrată acum, nu se filtrează în discover
    AND (min_height IS NULL OR p.height_cm IS NULL OR p.height_cm >= min_height)
    AND (max_height IS NULL OR p.height_cm IS NULL OR p.height_cm <= max_height)
    AND (NOT online_only OR ((now() - p.last_seen) < interval '5 minutes' AND NOT p.hide_online))
    AND (NOT with_photo_only OR (p.photos IS NOT NULL AND array_length(p.photos,1) > 0))
    AND (NOT verified_only OR p.verified_at IS NOT NULL)
    AND (NOT looking_now_only OR (p.looking_now_until IS NOT NULL AND p.looking_now_until > now()))
    AND me.location IS NOT NULL AND p.location IS NOT NULL
    AND ST_DWithin(me.location, p.location, max_distance_km * 1000)
    AND NOT EXISTS (SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = me.id AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = me.id))
  ORDER BY
    CASE WHEN order_mode = 'distance' AND me.location IS NOT NULL AND p.location IS NOT NULL
         THEN ST_Distance(me.location, p.location) END NULLS LAST,
    CASE WHEN order_mode = 'recent' THEN p.last_seen END DESC NULLS LAST,
    CASE WHEN order_mode = 'score' THEN 0 END,
    p.last_seen DESC NULLS LAST
  LIMIT result_limit;
END;
$function$;

-- Fix security finding: profile_live_events leakuiește prezența tuturor userilor.
-- Restricționăm SELECT la owner-ul rândului.
DROP POLICY IF EXISTS "Authenticated users can read profile live refresh signals" ON public.profile_live_events;
CREATE POLICY "Owner can read own live signal"
  ON public.profile_live_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
