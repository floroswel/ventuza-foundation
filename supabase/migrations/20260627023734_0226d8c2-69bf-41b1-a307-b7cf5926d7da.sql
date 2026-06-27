CREATE OR REPLACE FUNCTION public.admin_analytics_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM profiles),
    'verified_users', (SELECT count(*) FROM profiles WHERE age_status = 'verified'),
    'dau', (SELECT count(DISTINCT sender_id) FROM messages WHERE created_at > now() - interval '1 day'),
    'wau', (SELECT count(DISTINCT sender_id) FROM messages WHERE created_at > now() - interval '7 days'),
    'mau', (SELECT count(DISTINCT sender_id) FROM messages WHERE created_at > now() - interval '30 days'),
    'msg_24h', (SELECT count(*) FROM messages WHERE created_at > now() - interval '1 day'),
    'matches_24h', (SELECT count(*) FROM matches WHERE created_at > now() - interval '1 day'),
    'new_users_7d', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '7 days'),
    'reports_open', (SELECT count(*) FROM reports WHERE status IN ('open','pending')),
    'business_pending', (SELECT count(*) FROM business_applications WHERE status = 'pending'),
    'ads_pending', (SELECT count(*) FROM ad_campaigns WHERE status = 'pending'),
    'feedback_new', (SELECT count(*) FROM feedback WHERE status = 'new')
  ) INTO r;
  RETURN r;
END $$;