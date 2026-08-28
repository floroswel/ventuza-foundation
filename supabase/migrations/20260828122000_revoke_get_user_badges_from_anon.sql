-- ============================================================================
-- `get_user_badges(uuid)` nu mai este apelabilă de utilizatori neautentificați.
--
-- CE SE SCURGEA: funcția este SECURITY DEFINER, primește UUID-ul oricărui
-- utilizator și întoarce insignele lui. Pentru un vizitator anonim asta
-- înseamnă, despre orice cont al cărui UUID îl cunoaște:
--   · `verified`  → dacă persoana și-a verificat vârsta cu act de identitate;
--   · `founder`   → aproximativ când s-a înscris (cont dinainte de 2026-08-01);
--   · `matcher`   → dacă are cel puțin 25 de match-uri.
-- Într-o aplicație de dating, ultimul punct este informație despre viața
-- privată a cuiva, iar primul dezvăluie o interacțiune cu verificarea de
-- identitate. Niciuna nu are motiv să fie citibilă fără cont.
--
-- DE CE A APĂRUT: migrația 20260706175102 a re-acordat funcția către `anon`
-- odată cu insignele manuale. Acordarea inițială (20260703005138) era corectă:
-- doar `authenticated` și `service_role`.
--
-- DE CE E SIGUR SĂ REVOCĂM: nimic din aplicație nu apelează această funcție ca
-- anonim. Ecranele folosesc `get_user_badges_batch`, expusă exclusiv rolului
-- `authenticated` și apelată printr-un server function cu
-- `requireSupabaseAuth` (src/lib/badges.functions.ts). Profilul public
-- `/u/<slug>` citește `get_profile_by_slug`, nu insignele.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.get_user_badges(uuid) FROM anon;

-- Reafirmăm explicit rolurile permise: intenția rămâne vizibilă în schemă,
-- nu doar în istoricul migrațiilor.
GRANT EXECUTE ON FUNCTION public.get_user_badges(uuid) TO authenticated, service_role;

-- Varianta batch nu a fost niciodată expusă lui `anon`; o reconfirmăm ca o
-- eventuală re-acordare accidentală să iasă în evidență la diff.
REVOKE EXECUTE ON FUNCTION public.get_user_badges_batch(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_badges_batch(uuid[]) TO authenticated, service_role;
