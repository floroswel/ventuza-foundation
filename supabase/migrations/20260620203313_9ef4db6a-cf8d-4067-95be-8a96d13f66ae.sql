
DO $$
DECLARE
  demos JSONB := '[
    {"name":"Alexandru","age":28,"lng":26.1025,"lat":44.4268,"bio":"Architect by day, jazz by night.","tribes":["Twink","Jock"],"body":"slim","pos":"versatile","photo":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800"},
    {"name":"Marco","age":32,"lng":12.4964,"lat":41.9028,"bio":"Espresso, opera, long walks in Trastevere.","tribes":["Daddy","Bear"],"body":"average","pos":"top","photo":"https://images.unsplash.com/photo-1463453091185-61582044d556?w=800"},
    {"name":"Ethan","age":26,"lng":-0.1276,"lat":51.5074,"bio":"Painter. Tea drinker. Hopeless romantic.","tribes":["Twink"],"body":"slim","pos":"bottom","photo":"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800"},
    {"name":"Diego","age":30,"lng":-3.7038,"lat":40.4168,"bio":"Chef. Salsa. Sangria.","tribes":["Otter","Jock"],"body":"athletic","pos":"versatile","photo":"https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800"},
    {"name":"Yusuf","age":34,"lng":28.9784,"lat":41.0082,"bio":"Architect of small moments.","tribes":["Bear","Daddy"],"body":"stocky","pos":"top","photo":"https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800"},
    {"name":"Liam","age":25,"lng":-9.1393,"lat":38.7223,"bio":"Surfer. Songwriter.","tribes":["Otter"],"body":"slim","pos":"versatile_bottom","photo":"https://images.unsplash.com/photo-1488161628813-04466f872be2?w=800"},
    {"name":"Sasha","age":29,"lng":4.9041,"lat":52.3676,"bio":"Cyclist. Cinema lover.","tribes":["Twink","Otter"],"body":"slim","pos":"bottom","photo":"https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800"},
    {"name":"Noah","age":31,"lng":2.3522,"lat":48.8566,"bio":"Patisserie obsessive.","tribes":["Bear"],"body":"husky","pos":"versatile","photo":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"},
    {"name":"Kai","age":27,"lng":13.4050,"lat":52.5200,"bio":"DJ, vinyl hoarder, vegan baker.","tribes":["Twink","Geek"],"body":"slim","pos":"versatile","photo":"https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800"},
    {"name":"Andrei","age":33,"lng":26.1025,"lat":44.4268,"bio":"Sculptor. Climber. Quiet by default.","tribes":["Jock","Otter"],"body":"athletic","pos":"top","photo":"https://images.unsplash.com/photo-1504593811423-6dd665756598?w=800"},
    {"name":"Tomás","age":24,"lng":-3.7038,"lat":40.4168,"bio":"Med student. Marathon runner.","tribes":["Twink"],"body":"slim","pos":"bottom","photo":"https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=800"},
    {"name":"Mateo","age":36,"lng":12.4964,"lat":41.9028,"bio":"Lawyer who collects vinyl.","tribes":["Daddy","Bear"],"body":"stocky","pos":"top","photo":"https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800"}
  ]'::jsonb;
  d JSONB;
  uid uuid;
BEGIN
  FOR d IN SELECT * FROM jsonb_array_elements(demos)
  LOOP
    uid := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous)
    VALUES (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'demo-' || uid || '@ventuza.local', crypt(uid::text, gen_salt('bf')), now(), now(), now(),
            '{"provider":"demo","providers":["demo"]}'::jsonb,
            jsonb_build_object('demo', true, 'display_name', d->>'name'),
            false, false, false);

    UPDATE public.profiles SET
      display_name = d->>'name',
      birthdate = (current_date - ((d->>'age')::int * 365 || ' days')::interval)::date,
      gender = ARRAY['Man']::text[],
      pronouns = ARRAY['he/him']::text[],
      orientation = ARRAY['Gay']::text[],
      looking_for = ARRAY['Dates','Friends']::text[],
      interests = ARRAY['Travel','Music','Art']::text[],
      bio = d->>'bio',
      photos = ARRAY[d->>'photo']::text[],
      onboarding_completed = true,
      verified = (random() < 0.5),
      last_seen = now() - (random() * interval '90 minutes'),
      tribes = ARRAY(SELECT jsonb_array_elements_text(d->'tribes')),
      body_type = d->>'body',
      position = d->>'pos',
      hiv_status = 'Negative on PrEP',
      relationship_status = 'Single',
      location = ST_SetSRID(ST_MakePoint((d->>'lng')::float + (random()-0.5)*0.05, (d->>'lat')::float + (random()-0.5)*0.05), 4326)::geography,
      height_cm = 170 + (random()*25)::int
    WHERE id = uid;
  END LOOP;
END $$;
