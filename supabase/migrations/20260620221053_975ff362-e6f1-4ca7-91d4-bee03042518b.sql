
-- 1. DB-level age gate
CREATE OR REPLACE FUNCTION public.enforce_min_age()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.birthdate IS NOT NULL AND NEW.birthdate > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'Trebuie să ai cel puțin 18 ani pentru a folosi Ventuza.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_min_age_trg ON public.profiles;
CREATE TRIGGER enforce_min_age_trg BEFORE INSERT OR UPDATE OF birthdate ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_age();

-- 2. Admin role infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 3. Reports: add status + moderator access
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderator_notes text;

DROP POLICY IF EXISTS "moderators read all reports" ON public.reports;
CREATE POLICY "moderators read all reports" ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
DROP POLICY IF EXISTS "moderators update reports" ON public.reports;
CREATE POLICY "moderators update reports" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- 4. Profile suspension
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

-- 5. Auto-hide profiles with 3+ pending reports from discover (handled in discover_profiles fn — soft signal via column)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_count int NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.bump_report_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.target_user_id IS NOT NULL THEN
    UPDATE public.profiles SET report_count = report_count + 1 WHERE id = NEW.target_user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bump_report_count_trg ON public.reports;
CREATE TRIGGER bump_report_count_trg AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.bump_report_count();

-- 6. Moderator action: suspend/unsuspend user
CREATE OR REPLACE FUNCTION public.moderator_suspend_user(_target uuid, _hours int, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.profiles
    SET suspended_until = CASE WHEN _hours > 0 THEN now() + (_hours || ' hours')::interval ELSE NULL END,
        suspended_reason = _reason
    WHERE id = _target;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.moderator_suspend_user(uuid,int,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.moderator_suspend_user(uuid,int,text) TO authenticated;
