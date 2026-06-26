UPDATE public.feature_flags
SET enabled = false,
    description = 'Verificare vârstă cu Didit. DEV: OFF temporar (bypass în non-prod). PRODUCȚIA forțează ON indiferent de acest flag — vezi src/lib/age-gate-policy.ts.',
    updated_at = now()
WHERE key = 'age_verification';