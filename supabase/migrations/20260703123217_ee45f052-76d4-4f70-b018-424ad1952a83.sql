-- Elimină overload-ul vechi record_consent(text,text,boolean) care intra în conflict
-- cu cel nou (text,text,boolean,text). PostgREST arunca "could not choose the best
-- candidate function" când clientul apelează cu {_kind, _accepted} → toast
-- "Nu am putut înregistra consimțământul" (ex: Activează geofencing).
REVOKE ALL ON FUNCTION public.record_consent(text, text, boolean) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.record_consent(text, text, boolean);