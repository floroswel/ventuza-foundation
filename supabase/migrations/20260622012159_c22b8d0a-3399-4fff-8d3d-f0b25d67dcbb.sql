
CREATE TYPE public.business_entity_type AS ENUM ('srl','pfa','ii','sa','ong','asociatie','fundatie','brand','organizator_eveniment','altul');
CREATE TYPE public.business_app_status AS ENUM ('pending','reviewing','approved','rejected');

CREATE TABLE public.business_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type public.business_entity_type NOT NULL,
  legal_name text NOT NULL,
  brand_name text,
  cui text,
  reg_com text,
  vat_number text,
  country text NOT NULL DEFAULT 'RO',
  city text,
  address text,
  contact_name text NOT NULL,
  contact_role text,
  contact_email text NOT NULL,
  contact_phone text,
  website text,
  social_links text,
  category text,
  goals text NOT NULL,
  monthly_budget_eur integer,
  accepts_terms boolean NOT NULL DEFAULT false,
  accepts_dpa boolean NOT NULL DEFAULT false,
  accepts_lgbt_charter boolean NOT NULL DEFAULT false,
  status public.business_app_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_applications TO authenticated;
GRANT INSERT ON public.business_applications TO anon;
GRANT ALL ON public.business_applications TO service_role;

ALTER TABLE public.business_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit business application"
  ON public.business_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (accepts_terms = true AND accepts_dpa = true AND accepts_lgbt_charter = true);

CREATE POLICY "Users can view their own applications"
  ON public.business_applications FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Admins can view all applications"
  ON public.business_applications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update applications"
  ON public.business_applications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_business_applications_updated
  BEFORE UPDATE ON public.business_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_business_apps_status ON public.business_applications(status, created_at DESC);
