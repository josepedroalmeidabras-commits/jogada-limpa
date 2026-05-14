-- =============================================================================
-- 0076 — Corrigir encoding double-encoded (UTF-8 lido como MacRoman)
-- =============================================================================
-- Algumas colunas têm "Jo√£o" em vez de "João", "Andr√©" em vez de "André",
-- "Est√°dio" em vez de "Estádio" etc. Isto resulta de UTF-8 bytes a serem
-- interpretados como MacRoman/Mac OS Roman algures no pipeline.
--
-- Mapping:
--   ã (UTF-8 C3 A3) → √£   |   Ã (C3 83) → √É
--   á (C3 A1)      → √°    |   Á (C3 81) → √Å
--   à (C3 A0)      → √†    |   é (C3 A9) → √©
--   â (C3 A2)      → √¢    |   ê (C3 AA) → √™
--   í (C3 AD)      → √≠    |   ó (C3 B3) → √≥
--   ô (C3 B4)      → √¥    |   õ (C3 B5) → √µ
--   ú (C3 BA)      → √∫    |   ç (C3 A7) → √ß
--   Ç (C3 87)      → √á    |   Ó (C3 93) → √ì

create or replace function public.fix_macroman_encoding(s text)
returns text language sql immutable as $$
  select
    replace(replace(replace(replace(replace(replace(
    replace(replace(replace(replace(replace(replace(
    replace(replace(replace(replace(replace(replace(
    replace(replace(replace(replace(replace(replace(
      coalesce(s, ''),
      '√£',  'ã'),
      '√°',  'á'),
      '√†',  'à'),
      '√¢',  'â'),
      '√©',  'é'),
      '√™',  'ê'),
      '√≠',  'í'),
      '√≥',  'ó'),
      '√¥',  'ô'),
      '√µ',  'õ'),
      '√∫',  'ú'),
      '√ß',  'ç'),
      '√É',  'Ã'),
      '√Å',  'Á'),
      '√Ä',  'À'),
      '√Ç',  'Â'),
      '√â',  'É'),
      '√ä',  'Ê'),
      '√ç',  'Í'),
      '√ì',  'Ó'),
      '√î',  'Ô'),
      '√ï',  'Õ'),
      '√ö',  'Ú'),
      '√á',  'Ç');
$$;

-- profiles.name + nickname + bio + city
update public.profiles
set name = public.fix_macroman_encoding(name)
where name like '%√%';

update public.profiles
set nickname = public.fix_macroman_encoding(nickname)
where nickname like '%√%';

update public.profiles
set bio = public.fix_macroman_encoding(bio)
where bio like '%√%';

update public.profiles
set city = public.fix_macroman_encoding(city)
where city like '%√%';

-- teams
update public.teams
set name = public.fix_macroman_encoding(name)
where name like '%√%';

update public.teams
set city = public.fix_macroman_encoding(city)
where city like '%√%';

-- matches
update public.matches
set location_name = public.fix_macroman_encoding(location_name)
where location_name like '%√%';

update public.matches
set message = public.fix_macroman_encoding(message)
where message like '%√%';

update public.matches
set side_a_label = public.fix_macroman_encoding(side_a_label)
where side_a_label like '%√%';

update public.matches
set side_b_label = public.fix_macroman_encoding(side_b_label)
where side_b_label like '%√%';

-- team_reviews comments + user_reports details
update public.team_reviews
set comment = public.fix_macroman_encoding(comment)
where comment like '%√%';

update public.user_reports
set details = public.fix_macroman_encoding(details)
where details like '%√%';

-- sports.name (caso "Futebol" tenha sido afectado em algum momento)
update public.sports
set name = public.fix_macroman_encoding(name)
where name like '%√%';
