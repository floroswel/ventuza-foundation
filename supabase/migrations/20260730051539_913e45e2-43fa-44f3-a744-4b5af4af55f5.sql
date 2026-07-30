DO $$
DECLARE t text;
  tables text[] := ARRAY[
    'admin_audit_log','admin_sensitive_access_log','admin_impersonation_log','reports','risk_flags',
    'banned_fingerprints','admin_ip_allowlist','csam_hash_blocklist','csam_ncmec_queue','csam_reports',
    'policy_versions','policy_rule_versions','policy_evaluations','breach_incidents','illegal_content_reports',
    'admin_alerts','partner_invoices','dsa_sor','appeals','country_risk_config','verification_audit',
    'verification_images','verification_requests','support_ticket_messages','support_tickets','support_macros',
    'broadcast_campaigns','legal_document_versions','consent_log','app_settings_history'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I', t);
    END IF;
  END LOOP;

  DELETE FROM auth.users;

  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
    END IF;
  END LOOP;
END $$;