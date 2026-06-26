-- Single source of truth pentru bucketizarea distanței între useri.
-- Pragurile aici sunt SINGURUL loc de schimbat. Toate RPC-urile consumă rezultatul.
CREATE OR REPLACE FUNCTION public.bucket_distance_m(d double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  -- Anti-triangulation buckets. Returnează valoarea reprezentativă (centru bucket)
  -- în metri. Niciodată distanță exactă.
  SELECT CASE
    WHEN d IS NULL          THEN NULL
    WHEN d < 1000           THEN 500       -- "<1 km"
    WHEN d < 5000           THEN 3000      -- "1–5 km"
    WHEN d < 10000          THEN 7500      -- "5–10 km"
    WHEN d < 25000          THEN 17500     -- "10–25 km"
    WHEN d < 50000          THEN 37500     -- "25–50 km"
    WHEN d < 100000         THEN 75000     -- "50–100 km"
    ELSE round(d / 50000.0) * 50000        -- >100 km, rotunjit la 50 km
  END
$$;

-- Etichetă text consistentă pe whole-app. Tot un singur loc de schimbat.
CREATE OR REPLACE FUNCTION public.distance_bucket_label(d double precision)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN d IS NULL  THEN NULL
    WHEN d < 1000   THEN '<1 km'
    WHEN d < 5000   THEN '1–5 km'
    WHEN d < 10000  THEN '5–10 km'
    WHEN d < 25000  THEN '10–25 km'
    WHEN d < 50000  THEN '25–50 km'
    WHEN d < 100000 THEN '50–100 km'
    ELSE '>100 km'
  END
$$;

GRANT EXECUTE ON FUNCTION public.bucket_distance_m(double precision) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.distance_bucket_label(double precision) TO authenticated, anon;

COMMENT ON FUNCTION public.bucket_distance_m(double precision) IS
'Anti-triangulation bucket. SINGURUL loc unde se schimbă pragurile de distanță expuse altor useri. Vezi AGENTS.md secțiunea REGULĂ DE SIGURANȚĂ — LOCAȚIE.';
COMMENT ON FUNCTION public.distance_bucket_label(double precision) IS
'Etichetă text pentru bucket-ul de distanță. Folosește în loc să formatezi distanța în client.';