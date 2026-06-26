
CREATE OR REPLACE FUNCTION public.compute_geo_bucket_id(p_lat double precision, p_lng double precision)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
    ELSE floor(p_lat * 20)::text || ':' || floor(p_lng * 20)::text END;
$$;

CREATE OR REPLACE FUNCTION public.neighbour_buckets(p_bucket_id text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  parts text[];
  bx0 int; by0 int;
  result text[] := ARRAY[]::text[];
  dx int; dy int;
BEGIN
  IF p_bucket_id IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  parts := string_to_array(p_bucket_id, ':');
  IF array_length(parts, 1) <> 2 THEN RETURN ARRAY[]::text[]; END IF;
  bx0 := parts[1]::int;
  by0 := parts[2]::int;
  FOR dx IN -1..1 LOOP
    FOR dy IN -1..1 LOOP
      result := array_append(result, (bx0+dx)::text || ':' || (by0+dy)::text);
    END LOOP;
  END LOOP;
  RETURN result;
END;
$$;

CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text UNIQUE,
  category text NOT NULL DEFAULT 'other',
  description text,
  cover_url text,
  address text,
  city text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geo_bucket_id text NOT NULL DEFAULT '',
  opening_hours jsonb,
  website text,
  phone_e164 text,
  is_published boolean NOT NULL DEFAULT false,
  moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX venues_bucket_idx ON public.venues(geo_bucket_id) WHERE is_published;
CREATE INDEX venues_owner_idx ON public.venues(owner_id);

GRANT SELECT ON public.venues TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published venues are public" ON public.venues FOR SELECT USING (is_published = true);
CREATE POLICY "Owner can read own venues" ON public.venues FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owner can update own venues" ON public.venues FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND is_published = false);
CREATE POLICY "Owner can insert own venues" ON public.venues FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND is_published = false);
CREATE POLICY "Staff can manage venues" ON public.venues FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator']::app_role[]));

CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  terms text,
  valid_from timestamptz,
  valid_to timestamptz,
  max_claims_per_user int NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT false,
  moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX offers_venue_idx ON public.offers(venue_id);
CREATE INDEX offers_published_idx ON public.offers(is_published, valid_to);

GRANT SELECT ON public.offers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published offers public" ON public.offers FOR SELECT USING (
  is_published = true AND EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.is_published = true));
CREATE POLICY "Venue owner manages offers" ON public.offers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid()));
CREATE POLICY "Staff manages offers" ON public.offers FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator']::app_role[]));

CREATE TABLE public.offer_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redemption_code text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);
CREATE INDEX offer_claims_user_idx ON public.offer_claims(user_id);
CREATE INDEX offer_claims_offer_idx ON public.offer_claims(offer_id);

GRANT SELECT ON public.offer_claims TO authenticated;
GRANT ALL ON public.offer_claims TO service_role;

ALTER TABLE public.offer_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads own claims" ON public.offer_claims FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS geo_bucket_id text;
CREATE INDEX IF NOT EXISTS events_bucket_idx ON public.events(geo_bucket_id);

CREATE OR REPLACE FUNCTION public.set_geo_bucket_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.geo_bucket_id := public.compute_geo_bucket_id(NEW.lat, NEW.lng); RETURN NEW; END;
$$;

CREATE TRIGGER venues_set_bucket BEFORE INSERT OR UPDATE OF lat, lng ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.set_geo_bucket_id();
CREATE TRIGGER events_set_bucket BEFORE INSERT OR UPDATE OF lat, lng ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_geo_bucket_id();

UPDATE public.events SET geo_bucket_id = public.compute_geo_bucket_id(lat, lng)
WHERE geo_bucket_id IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER venues_touch_updated_at BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER offers_touch_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.nearby_points(p_bucket_id text, p_kinds text[] DEFAULT ARRAY['venue','event','offer'])
RETURNS TABLE (
  kind text, id uuid, venue_id uuid, name text, category text, description text,
  cover_url text, lat double precision, lng double precision,
  starts_at timestamptz, ends_at timestamptz, city text
) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE buckets text[];
BEGIN
  IF p_bucket_id IS NULL THEN RETURN; END IF;
  buckets := public.neighbour_buckets(p_bucket_id);

  IF 'venue' = ANY(p_kinds) THEN
    RETURN QUERY
      SELECT 'venue'::text, v.id, NULL::uuid, v.name, v.category, v.description,
             v.cover_url, v.lat, v.lng, NULL::timestamptz, NULL::timestamptz, v.city
      FROM public.venues v
      WHERE v.is_published = true AND v.geo_bucket_id = ANY(buckets)
      LIMIT 200;
  END IF;

  IF 'event' = ANY(p_kinds) THEN
    RETURN QUERY
      SELECT 'event'::text, e.id, NULL::uuid, e.title, e.event_type::text, e.description,
             e.cover_url, e.lat, e.lng, e.starts_at, e.ends_at, e.city
      FROM public.events e
      WHERE e.is_private = false
        AND e.geo_bucket_id = ANY(buckets)
        AND (e.ends_at IS NULL OR e.ends_at > now())
      LIMIT 200;
  END IF;

  IF 'offer' = ANY(p_kinds) THEN
    RETURN QUERY
      SELECT 'offer'::text, o.id, v.id, o.title, v.category, o.description,
             v.cover_url, v.lat, v.lng, o.valid_from, o.valid_to, v.city
      FROM public.offers o
      JOIN public.venues v ON v.id = o.venue_id
      WHERE o.is_published = true AND v.is_published = true
        AND v.geo_bucket_id = ANY(buckets)
        AND (o.valid_to IS NULL OR o.valid_to > now())
      LIMIT 200;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.nearby_points(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nearby_points(text, text[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_offer(p_offer_id uuid)
RETURNS TABLE(claim_id uuid, redemption_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_offer record;
  v_existing int;
  v_code text;
  v_claim_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT o.*, v.is_published AS v_pub INTO v_offer
  FROM public.offers o JOIN public.venues v ON v.id = o.venue_id WHERE o.id = p_offer_id;
  IF NOT FOUND OR NOT v_offer.is_published OR NOT v_offer.v_pub THEN RAISE EXCEPTION 'offer_not_available'; END IF;
  IF v_offer.valid_to IS NOT NULL AND v_offer.valid_to < now() THEN RAISE EXCEPTION 'offer_expired'; END IF;
  IF v_offer.valid_from IS NOT NULL AND v_offer.valid_from > now() THEN RAISE EXCEPTION 'offer_not_started'; END IF;
  SELECT count(*) INTO v_existing FROM public.offer_claims WHERE offer_id = p_offer_id AND user_id = v_user;
  IF v_existing >= v_offer.max_claims_per_user THEN RAISE EXCEPTION 'offer_already_claimed'; END IF;
  v_code := upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 8));
  INSERT INTO public.offer_claims (offer_id, user_id, redemption_code) VALUES (p_offer_id, v_user, v_code) RETURNING id INTO v_claim_id;
  RETURN QUERY SELECT v_claim_id, v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_offer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_offer(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.offer_stats(p_offer_id uuid)
RETURNS TABLE(claim_count bigint, redeemed_count bigint)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_is_owner boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.offers o JOIN public.venues v ON v.id = o.venue_id
    WHERE o.id = p_offer_id AND v.owner_id = v_user) INTO v_is_owner;
  IF NOT v_is_owner AND NOT public.has_any_role(v_user, ARRAY['admin','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY SELECT count(*)::bigint, count(*) FILTER (WHERE redeemed_at IS NOT NULL)::bigint
    FROM public.offer_claims WHERE offer_id = p_offer_id;
END;
$$;
REVOKE ALL ON FUNCTION public.offer_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offer_stats(uuid) TO authenticated;

ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false;
