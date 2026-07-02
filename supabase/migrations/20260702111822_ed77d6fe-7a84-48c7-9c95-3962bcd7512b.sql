
CREATE TABLE IF NOT EXISTS public.legal_documents (
  slug text PRIMARY KEY,
  title text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1,
  published_at timestamptz,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT ALL ON public.legal_documents TO service_role;

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_documents public read published"
  ON public.legal_documents FOR SELECT
  TO anon, authenticated
  USING (published_at IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  content_md text NOT NULL,
  version int NOT NULL,
  published_at timestamptz,
  edited_by uuid REFERENCES auth.users(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.legal_document_versions TO authenticated;
GRANT ALL ON public.legal_document_versions TO service_role;

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_versions admin read"
  ON public.legal_document_versions FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_legal_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_legal_documents ON public.legal_documents;
CREATE TRIGGER trg_touch_legal_documents
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_legal_documents_updated_at();

-- Seed slots (empty drafts; won't override static routes until admin fills+publishes)
INSERT INTO public.legal_documents (slug, title) VALUES
  ('terms', 'Termeni și condiții'),
  ('privacy', 'Politica de confidențialitate'),
  ('cookies', 'Politica de cookie-uri'),
  ('community', 'Reguli de comunitate'),
  ('dmca', 'DMCA — Drepturi de autor'),
  ('dsa', 'Digital Services Act — Punct de contact'),
  ('age-policy', 'Politică 18+'),
  ('business-terms', 'Termeni parteneri B2B'),
  ('security-incidents', 'Istoric incidente de securitate'),
  ('safety', 'Centru de siguranță')
ON CONFLICT (slug) DO NOTHING;

-- Admin upsert (draft)
CREATE OR REPLACE FUNCTION public.admin_upsert_legal_document(
  _slug text, _title text, _content_md text
) RETURNS public.legal_documents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _row public.legal_documents;
BEGIN
  IF NOT public.is_admin_or_above(_actor) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.legal_documents (slug, title, content_md, updated_by)
  VALUES (_slug, _title, _content_md, _actor)
  ON CONFLICT (slug) DO UPDATE
    SET title = EXCLUDED.title,
        content_md = EXCLUDED.content_md,
        version = public.legal_documents.version + 1,
        updated_by = _actor,
        updated_at = now()
  RETURNING * INTO _row;

  INSERT INTO public.legal_document_versions
    (slug, title, content_md, version, published_at, edited_by, action)
  VALUES (_row.slug, _row.title, _row.content_md, _row.version, _row.published_at, _actor, 'save_draft');

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata, severity)
  VALUES (_actor, 'legal_document_saved', 'legal_document', _slug,
          jsonb_build_object('version', _row.version, 'title', _title), 'info');

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_legal_document(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_legal_document(text, text, text) TO authenticated;

-- Publish current draft
CREATE OR REPLACE FUNCTION public.admin_publish_legal_document(_slug text)
RETURNS public.legal_documents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _row public.legal_documents;
BEGIN
  IF NOT public.is_admin_or_above(_actor) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.legal_documents
     SET published_at = now(), updated_by = _actor, updated_at = now()
   WHERE slug = _slug
   RETURNING * INTO _row;

  IF _row.slug IS NULL THEN
    RAISE EXCEPTION 'legal_document_not_found: %', _slug;
  END IF;

  INSERT INTO public.legal_document_versions
    (slug, title, content_md, version, published_at, edited_by, action)
  VALUES (_row.slug, _row.title, _row.content_md, _row.version, _row.published_at, _actor, 'publish');

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata, severity)
  VALUES (_actor, 'legal_document_published', 'legal_document', _slug,
          jsonb_build_object('version', _row.version), 'warning');

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_legal_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publish_legal_document(text) TO authenticated;

-- Unpublish (revert to static fallback)
CREATE OR REPLACE FUNCTION public.admin_unpublish_legal_document(_slug text)
RETURNS public.legal_documents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _row public.legal_documents;
BEGIN
  IF NOT public.is_admin_or_above(_actor) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.legal_documents
     SET published_at = NULL, updated_by = _actor, updated_at = now()
   WHERE slug = _slug
   RETURNING * INTO _row;

  IF _row.slug IS NULL THEN
    RAISE EXCEPTION 'legal_document_not_found: %', _slug;
  END IF;

  INSERT INTO public.legal_document_versions
    (slug, title, content_md, version, published_at, edited_by, action)
  VALUES (_row.slug, _row.title, _row.content_md, _row.version, NULL, _actor, 'unpublish');

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata, severity)
  VALUES (_actor, 'legal_document_unpublished', 'legal_document', _slug,
          jsonb_build_object('version', _row.version), 'warning');

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unpublish_legal_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unpublish_legal_document(text) TO authenticated;

-- Admin list (all incl. drafts)
CREATE OR REPLACE FUNCTION public.admin_list_legal_documents()
RETURNS SETOF public.legal_documents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.legal_documents ORDER BY slug;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_legal_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_legal_documents() TO authenticated;

-- Version history
CREATE OR REPLACE FUNCTION public.admin_legal_document_history(_slug text)
RETURNS SETOF public.legal_document_versions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT * FROM public.legal_document_versions
     WHERE slug = _slug
     ORDER BY created_at DESC
     LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_legal_document_history(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_legal_document_history(text) TO authenticated;

-- Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.legal_documents;
