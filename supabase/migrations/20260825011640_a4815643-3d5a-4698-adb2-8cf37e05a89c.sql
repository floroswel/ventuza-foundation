DO $$
DECLARE q text;
BEGIN
  SELECT pg_get_expr(polwithcheck, polrelid) INTO q
  FROM pg_policy WHERE polname = 'group_members_join_self' AND polrelid = 'public.group_members'::regclass;
  RAISE NOTICE 'current: %', q;
END $$;

DROP POLICY IF EXISTS group_members_join_self ON public.group_members;

CREATE POLICY group_members_join_self
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.is_public = true
  )
);