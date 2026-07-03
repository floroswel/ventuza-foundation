alter table public.profiles
  add column if not exists preferred_language text
    check (preferred_language is null or char_length(preferred_language) between 2 and 8);

comment on column public.profiles.preferred_language is
  'Limba preferată a autorului pentru propriul profil (ex: ro, en). Folosită pentru a decide auto-traducerea către vizitatori din alte țări.';