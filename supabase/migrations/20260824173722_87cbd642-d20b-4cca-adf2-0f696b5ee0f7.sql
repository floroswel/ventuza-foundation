INSERT INTO public.groups (name, description, owner_id, is_public, member_count)
SELECT v.name, v.description, '20c526d8-dd18-40ad-bb5c-543d7377cf24'::uuid, true, 1
FROM (VALUES
  ('București Queer', 'Squad oficial pentru comunitatea din București: ieșiri, recomandări, evenimente.'),
  ('Cluj Queer', 'Squad oficial pentru Cluj-Napoca: cine e prin oraș, ce se întâmplă în weekend.'),
  ('Cafea & Chill', 'Întâlniri relaxate la cafea, fără presiune. Perfect dacă ești nou pe Suzeta.'),
  ('Sport & Fitness', 'Sală, alergare, drumeții — găsește-ți partener de antrenament.'),
  ('Film & Serale', 'Recomandări de filme și seriale, seri de film împreună.')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.name = v.name);

INSERT INTO public.group_members (group_id, user_id)
SELECT g.id, g.owner_id
FROM public.groups g
WHERE g.owner_id = '20c526d8-dd18-40ad-bb5c-543d7377cf24'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.group_members m WHERE m.group_id = g.id AND m.user_id = g.owner_id
  );