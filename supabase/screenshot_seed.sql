-- =============================================================================
-- SEED: fake players, teams and a handful of validated matches
-- =============================================================================
-- Purely for visualization during development. Re-runnable: all inserts guarded
-- by `on conflict do nothing`, so running twice is a no-op.
--
-- Conventions used:
-- • All players in Coimbra, sport_id = 2 (Futebol 7).
-- • Avatars from pravatar.cc (stable per seed); team logos from dicebear shapes.
-- • Passwords set to a known bcrypt hash for 'testpass123' so the founder can
--   sign in as any of them via Studio if needed (NEVER reuse in prod).
-- • Birthdates are well over 18 to satisfy the chk_age constraint.

do $$
declare
  -- ------------- players ----------------------------------------------------
  v_pwd_hash    text := crypt('testpass123', gen_salt('bf'));
  v_p1 uuid := 'aaaaaaaa-0001-4000-8000-000000000001';  -- João Marques
  v_p2 uuid := 'aaaaaaaa-0001-4000-8000-000000000002';  -- Tiago Sousa
  v_p3 uuid := 'aaaaaaaa-0001-4000-8000-000000000003';  -- Rui Patrício
  v_p4 uuid := 'aaaaaaaa-0001-4000-8000-000000000004';  -- Miguel Almeida
  v_p5 uuid := 'aaaaaaaa-0001-4000-8000-000000000005';  -- André Pinto
  v_p6 uuid := 'aaaaaaaa-0001-4000-8000-000000000006';  -- Bruno Carvalho
  v_p7 uuid := 'aaaaaaaa-0001-4000-8000-000000000007';  -- Diogo Faria
  v_p8 uuid := 'aaaaaaaa-0001-4000-8000-000000000008';  -- Pedro Lopes
  v_p9 uuid := 'aaaaaaaa-0001-4000-8000-000000000009';  -- Hugo Tavares
  v_p10 uuid := 'aaaaaaaa-0001-4000-8000-000000000010'; -- Ricardo Mendes
  v_p11 uuid := 'aaaaaaaa-0001-4000-8000-000000000011'; -- Filipe Branco
  v_p12 uuid := 'aaaaaaaa-0001-4000-8000-000000000012'; -- Manuel Costa
  v_p13 uuid := 'aaaaaaaa-0001-4000-8000-000000000013'; -- Nuno Pereira
  v_p14 uuid := 'aaaaaaaa-0001-4000-8000-000000000014'; -- Fábio Silva
  v_p15 uuid := 'aaaaaaaa-0001-4000-8000-000000000015'; -- Sérgio Vieira

  -- ------------- teams ------------------------------------------------------
  v_t1 uuid := 'bbbbbbbb-0001-4000-8000-000000000001';  -- Bombs FC
  v_t2 uuid := 'bbbbbbbb-0001-4000-8000-000000000002';  -- Real Coimbra
  v_t3 uuid := 'bbbbbbbb-0001-4000-8000-000000000003';  -- Solum Stars
  v_t4 uuid := 'bbbbbbbb-0001-4000-8000-000000000004';  -- Olivais Athletic

  -- ------------- matches ----------------------------------------------------
  v_m1 uuid := 'cccccccc-0001-4000-8000-000000000001';
  v_m2 uuid := 'cccccccc-0001-4000-8000-000000000002';
  v_m3 uuid := 'cccccccc-0001-4000-8000-000000000003';
  v_m4 uuid := 'cccccccc-0001-4000-8000-000000000004';
  v_m5 uuid := 'cccccccc-0001-4000-8000-000000000005';
  v_m6 uuid := 'cccccccc-0001-4000-8000-000000000006';
begin

  -- ----------------------------------------------------------------------------
  -- 1. AUTH USERS (skipped if email already exists)
  -- ----------------------------------------------------------------------------
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at
  )
  values
    (v_p1,  '00000000-0000-0000-0000-000000000000', 'fake01@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p2,  '00000000-0000-0000-0000-000000000000', 'fake02@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p3,  '00000000-0000-0000-0000-000000000000', 'fake03@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p4,  '00000000-0000-0000-0000-000000000000', 'fake04@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p5,  '00000000-0000-0000-0000-000000000000', 'fake05@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p6,  '00000000-0000-0000-0000-000000000000', 'fake06@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p7,  '00000000-0000-0000-0000-000000000000', 'fake07@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p8,  '00000000-0000-0000-0000-000000000000', 'fake08@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p9,  '00000000-0000-0000-0000-000000000000', 'fake09@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p10, '00000000-0000-0000-0000-000000000000', 'fake10@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p11, '00000000-0000-0000-0000-000000000000', 'fake11@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p12, '00000000-0000-0000-0000-000000000000', 'fake12@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p13, '00000000-0000-0000-0000-000000000000', 'fake13@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p14, '00000000-0000-0000-0000-000000000000', 'fake14@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now()),
    (v_p15, '00000000-0000-0000-0000-000000000000', 'fake15@jogadalimpa.local', v_pwd_hash, now(), '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now())
  on conflict (id) do nothing;

  -- ----------------------------------------------------------------------------
  -- 2. PROFILES
  -- ----------------------------------------------------------------------------
  insert into public.profiles (id, name, photo_url, city, birthdate, bio) values
    (v_p1,  'João Marques',    'https://i.pravatar.cc/200?img=12', 'Coimbra', '1992-03-14', 'Médio centro. Gosto de ditar o ritmo.'),
    (v_p2,  'Tiago Sousa',     'https://i.pravatar.cc/200?img=13', 'Coimbra', '1990-07-22', 'Ponta-de-lança. Cabeceio é o meu forte.'),
    (v_p3,  'Rui Patrício',    'https://i.pravatar.cc/200?img=14', 'Coimbra', '1988-01-09', 'Guarda-redes desde miúdo.'),
    (v_p4,  'Miguel Almeida',  'https://i.pravatar.cc/200?img=15', 'Coimbra', '1995-11-30', null),
    (v_p5,  'André Pinto',     'https://i.pravatar.cc/200?img=33', 'Coimbra', '1993-05-18', 'Defesa central. Marco apertado.'),
    (v_p6,  'Bruno Carvalho',  'https://i.pravatar.cc/200?img=51', 'Coimbra', '1991-09-04', 'Lateral direito veloz.'),
    (v_p7,  'Diogo Faria',     'https://i.pravatar.cc/200?img=52', 'Coimbra', '1989-12-25', 'Médio defensivo. Cumpro horários.'),
    (v_p8,  'Pedro Lopes',     'https://i.pravatar.cc/200?img=53', 'Coimbra', '1994-02-17', null),
    (v_p9,  'Hugo Tavares',    'https://i.pravatar.cc/200?img=54', 'Coimbra', '1990-08-11', 'Extremo. Drible é a minha cena.'),
    (v_p10, 'Ricardo Mendes',  'https://i.pravatar.cc/200?img=60', 'Coimbra', '1996-04-03', 'Vou onde for preciso.'),
    (v_p11, 'Filipe Branco',   'https://i.pravatar.cc/200?img=61', 'Coimbra', '1987-10-19', null),
    (v_p12, 'Manuel Costa',    'https://i.pravatar.cc/200?img=62', 'Coimbra', '1993-06-28', 'Lateral esquerdo. Subo muito.'),
    (v_p13, 'Nuno Pereira',    'https://i.pravatar.cc/200?img=63', 'Coimbra', '1991-12-07', null),
    (v_p14, 'Fábio Silva',     'https://i.pravatar.cc/200?img=64', 'Coimbra', '1995-08-15', 'Avançado. Faro de golo.'),
    (v_p15, 'Sérgio Vieira',   'https://i.pravatar.cc/200?img=65', 'Coimbra', '1990-02-22', null)
  on conflict (id) do nothing;

  -- ----------------------------------------------------------------------------
  -- 3. USER_SPORTS — Futebol 7 (sport_id 2), varied ELOs
  -- ----------------------------------------------------------------------------
  insert into public.user_sports (user_id, sport_id, declared_level, elo, matches_played, preferred_position) values
    (v_p1,  2, 7, 1340, 12, 'med'),
    (v_p2,  2, 8, 1410, 14, 'ata'),
    (v_p3,  2, 6, 1280, 10, 'gr'),
    (v_p4,  2, 5, 1180,  8, null),
    (v_p5,  2, 7, 1320,  9, 'def'),
    (v_p6,  2, 6, 1250,  7, 'def'),
    (v_p7,  2, 7, 1310, 11, 'med'),
    (v_p8,  2, 5, 1200,  6, null),
    (v_p9,  2, 8, 1390, 13, 'ata'),
    (v_p10, 2, 4, 1130,  4, null),
    (v_p11, 2, 6, 1260,  8, 'med'),
    (v_p12, 2, 5, 1190,  5, 'def'),
    (v_p13, 2, 5, 1220,  6, null),
    (v_p14, 2, 8, 1430, 15, 'ata'),
    (v_p15, 2, 6, 1270,  7, null)
  on conflict (user_id, sport_id) do nothing;

  -- ----------------------------------------------------------------------------
  -- 4. TEAMS — 4 teams in Coimbra, F7
  -- ----------------------------------------------------------------------------
  insert into public.teams (id, name, photo_url, sport_id, city, captain_id, description, is_active) values
    (v_t1, 'Bombs FC',          'https://api.dicebear.com/7.x/shapes/png?seed=Bombs',          2, 'Coimbra', v_p1, 'Grupo de amigos desde 2018. Jogamos aos sábados à noite.', true),
    (v_t2, 'Real Coimbra',      'https://api.dicebear.com/7.x/shapes/png?seed=RealCoimbra',    2, 'Coimbra', v_p5, 'Equipa veterana do bairro de Celas.', true),
    (v_t3, 'Solum Stars',       'https://api.dicebear.com/7.x/shapes/png?seed=SolumStars',     2, 'Coimbra', v_p9, 'Jovens com fome de golo.', true),
    (v_t4, 'Olivais Athletic',  'https://api.dicebear.com/7.x/shapes/png?seed=OlivaisAthletic',2, 'Coimbra', v_p14, 'Polidesportivo dos Olivais é a nossa casa.', true)
  on conflict (id) do nothing;

  -- ----------------------------------------------------------------------------
  -- 5. TEAM MEMBERS
  -- ----------------------------------------------------------------------------
  insert into public.team_members (team_id, user_id, role) values
    -- Bombs FC (captain: p1)
    (v_t1, v_p1,  'captain'),
    (v_t1, v_p2,  'member'),
    (v_t1, v_p3,  'member'),
    (v_t1, v_p4,  'member'),
    -- Real Coimbra (captain: p5)
    (v_t2, v_p5,  'captain'),
    (v_t2, v_p6,  'member'),
    (v_t2, v_p7,  'member'),
    (v_t2, v_p8,  'member'),
    -- Solum Stars (captain: p9)
    (v_t3, v_p9,  'captain'),
    (v_t3, v_p10, 'member'),
    (v_t3, v_p11, 'member'),
    (v_t3, v_p12, 'member'),
    -- Olivais Athletic (captain: p14)
    (v_t4, v_p14, 'captain'),
    (v_t4, v_p13, 'member'),
    (v_t4, v_p15, 'member')
  on conflict (team_id, user_id) do nothing;

  -- ----------------------------------------------------------------------------
  -- 6. PAST VALIDATED MATCHES — populate rankings, h2h, friend feeds
  -- ----------------------------------------------------------------------------
  -- We bypass the score-submission trigger by inserting directly with status
  -- 'validated' and validated_at filled. The ELO-recompute trigger fires on
  -- the status change, but we pre-populate elo via user_sports above so it
  -- evens out. For the seed, what matters is the visible result.
  insert into public.matches (
    id, sport_id, scheduled_at, location_name, location_tbd,
    status, proposed_by, final_score_a, final_score_b, validated_at
  ) values
    (v_m1, 2, now() - interval '21 days', 'Estádio Académica', false, 'validated', v_p1,  3, 2, now() - interval '21 days'),
    (v_m2, 2, now() - interval '14 days', 'Polidesportivo Olivais', false, 'validated', v_p5,  1, 1, now() - interval '14 days'),
    (v_m3, 2, now() - interval '10 days', 'Pavilhão Solum', false, 'validated', v_p9,  4, 0, now() - interval '10 days'),
    (v_m4, 2, now() - interval  '7 days', 'Estádio Académica', false, 'validated', v_p14, 2, 3, now() - interval '7 days'),
    (v_m5, 2, now() - interval  '4 days', 'Polidesportivo Olivais', false, 'validated', v_p1,  2, 1, now() - interval '4 days'),
    (v_m6, 2, now() - interval  '2 days', 'Pavilhão Solum', false, 'validated', v_p9,  3, 1, now() - interval '2 days')
  on conflict (id) do nothing;

  -- Match sides
  insert into public.match_sides (match_id, side, team_id, captain_id) values
    (v_m1, 'A', v_t1, v_p1),  (v_m1, 'B', v_t2, v_p5),  -- Bombs 3 - 2 Real
    (v_m2, 'A', v_t2, v_p5),  (v_m2, 'B', v_t3, v_p9),  -- Real 1 - 1 Solum
    (v_m3, 'A', v_t3, v_p9),  (v_m3, 'B', v_t4, v_p14), -- Solum 4 - 0 Olivais
    (v_m4, 'A', v_t4, v_p14), (v_m4, 'B', v_t1, v_p1),  -- Olivais 2 - 3 Bombs
    (v_m5, 'A', v_t1, v_p1),  (v_m5, 'B', v_t3, v_p9),  -- Bombs 2 - 1 Solum
    (v_m6, 'A', v_t3, v_p9),  (v_m6, 'B', v_t2, v_p5)   -- Solum 3 - 1 Real
  on conflict (match_id, side) do nothing;

  -- Match participants (attended) for each captain + 2 teammates per side
  insert into public.match_participants (match_id, user_id, side, attendance) values
    -- m1: Bombs vs Real
    (v_m1, v_p1, 'A', 'attended'), (v_m1, v_p2, 'A', 'attended'), (v_m1, v_p3, 'A', 'attended'),
    (v_m1, v_p5, 'B', 'attended'), (v_m1, v_p6, 'B', 'attended'), (v_m1, v_p7, 'B', 'attended'),
    -- m2: Real vs Solum
    (v_m2, v_p5, 'A', 'attended'), (v_m2, v_p6, 'A', 'attended'), (v_m2, v_p8, 'A', 'attended'),
    (v_m2, v_p9, 'B', 'attended'), (v_m2, v_p10,'B', 'attended'), (v_m2, v_p11,'B', 'attended'),
    -- m3: Solum vs Olivais
    (v_m3, v_p9, 'A', 'attended'), (v_m3, v_p10,'A', 'attended'), (v_m3, v_p12,'A', 'attended'),
    (v_m3, v_p14,'B', 'attended'), (v_m3, v_p13,'B', 'attended'), (v_m3, v_p15,'B', 'attended'),
    -- m4: Olivais vs Bombs
    (v_m4, v_p14,'A', 'attended'), (v_m4, v_p13,'A', 'attended'), (v_m4, v_p15,'A', 'attended'),
    (v_m4, v_p1, 'B', 'attended'), (v_m4, v_p2, 'B', 'attended'), (v_m4, v_p4, 'B', 'attended'),
    -- m5: Bombs vs Solum
    (v_m5, v_p1, 'A', 'attended'), (v_m5, v_p2, 'A', 'attended'), (v_m5, v_p3, 'A', 'attended'),
    (v_m5, v_p9, 'B', 'attended'), (v_m5, v_p11,'B', 'attended'), (v_m5, v_p12,'B', 'attended'),
    -- m6: Solum vs Real
    (v_m6, v_p9, 'A', 'attended'), (v_m6, v_p10,'A', 'attended'), (v_m6, v_p12,'A', 'attended'),
    (v_m6, v_p5, 'B', 'attended'), (v_m6, v_p7, 'B', 'attended'), (v_m6, v_p8, 'B', 'attended')
  on conflict (match_id, user_id) do nothing;

end $$;
-- =============================================================================
-- Boost ao seed — Bombs FC com 16 membros para testar peladinhas 8v8
-- =============================================================================
-- Adiciona 1 jogador novo (p16, guarda-redes), preenche posições em falta
-- nos jogadores fake existentes e mete todos como membros de Bombs FC para
-- ser possível dividir 8 contra 8 numa peladinha.

do $$
declare
  v_pwd  text := crypt('testpass123', gen_salt('bf'));
  v_p16  uuid := 'aaaaaaaa-0001-4000-8000-000000000016';
  v_t1   uuid := 'bbbbbbbb-0001-4000-8000-000000000001';
begin
  -- New keeper
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
  ) values
    (v_p16, '00000000-0000-0000-0000-000000000000',
     'fake16@jogadalimpa.local', v_pwd, now(),
     '{"provider":"email"}', '{}', 'authenticated', 'authenticated', now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, name, photo_url, city, birthdate, bio) values
    (v_p16, 'Eduardo Castro', 'https://i.pravatar.cc/200?img=66',
     'Coimbra', '1991-03-12', 'Guarda-redes. 1.85m, mãos boas em saídas baixas.')
  on conflict (id) do nothing;

  insert into public.user_sports (user_id, sport_id, declared_level, elo, matches_played, preferred_position)
  values (v_p16, 2, 7, 1300, 9, 'gr')
  on conflict (user_id, sport_id) do nothing;

  -- Fill in positions for fakes that were null
  update public.user_sports set preferred_position = 'med'
    where user_id = 'aaaaaaaa-0001-4000-8000-000000000004' and sport_id = 2 and preferred_position is null;
  update public.user_sports set preferred_position = 'ata'
    where user_id = 'aaaaaaaa-0001-4000-8000-000000000008' and sport_id = 2 and preferred_position is null;
  update public.user_sports set preferred_position = 'def'
    where user_id = 'aaaaaaaa-0001-4000-8000-000000000010' and sport_id = 2 and preferred_position is null;
  update public.user_sports set preferred_position = 'med'
    where user_id = 'aaaaaaaa-0001-4000-8000-000000000013' and sport_id = 2 and preferred_position is null;
  update public.user_sports set preferred_position = 'def'
    where user_id = 'aaaaaaaa-0001-4000-8000-000000000015' and sport_id = 2 and preferred_position is null;

  -- Pour everyone into Bombs FC so a peladinha 8v8 is testable
  insert into public.team_members (team_id, user_id, role) values
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000005', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000006', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000007', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000008', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000009', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000010', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000011', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000012', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000013', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000014', 'member'),
    (v_t1, 'aaaaaaaa-0001-4000-8000-000000000015', 'member'),
    (v_t1, v_p16, 'member')
  on conflict (team_id, user_id) do nothing;
end $$;
-- =============================================================================
-- 0066 — TEST DATA SEED: peladinhas, amigos, reviews, faceoffs, pending stuff
-- =============================================================================
-- Idempotente: pode correr várias vezes sem duplicar (usa NOT EXISTS / ON CONFLICT).
-- Encontra o user "real" (não fake@jogadalimpa.local), preenche tudo o que ele
-- precisa para testar a app no Expo Go.
--
-- IMPORTANTE: deve ser removido com `delete from auth.users where email like 'fake%@jogadalimpa.local'`
-- antes do lançamento público (ver memory).

do $$
declare
  v_user_id       uuid;
  v_team_id       uuid;
  v_sport_id      int;
  v_match_id      uuid;
  v_score_a       int;
  v_score_b       int;
  v_my_side       text;
  v_fakes         uuid[];
  v_friends_added int := 0;
  v_pel_added     int := 0;
  v_rev_added     int := 0;
  v_face_added    int := 0;
  fake_id         uuid;
  comp_match      record;
  i               int;
begin
  -- ----- 1. Find the real user (José Pedro) -----
  select id into v_user_id
  from auth.users
  where email not like 'fake%@jogadalimpa.local'
    and email is not null
  order by created_at desc
  limit 1;

  if v_user_id is null then
    raise notice 'Nenhum user real encontrado — abort seed.';
    return;
  end if;

  -- ----- 2. Find his main team (captain first, else first membership) -----
  select t.id, t.sport_id into v_team_id, v_sport_id
  from public.teams t
  where t.captain_id = v_user_id and t.is_active
  order by t.created_at desc
  limit 1;

  if v_team_id is null then
    select t.id, t.sport_id into v_team_id, v_sport_id
    from public.teams t
    join public.team_members tm on tm.team_id = t.id
    where tm.user_id = v_user_id and t.is_active
    order by t.created_at desc
    limit 1;
  end if;

  if v_team_id is null then
    raise notice 'User % não pertence a nenhuma equipa — abort seed.', v_user_id;
    return;
  end if;

  -- ----- 3. Collect fake users that are also members of this team -----
  select array_agg(tm.user_id order by tm.joined_at) into v_fakes
  from public.team_members tm
  join auth.users u on u.id = tm.user_id
  where tm.team_id = v_team_id
    and u.email like 'fake%@jogadalimpa.local';

  if v_fakes is null or array_length(v_fakes, 1) < 7 then
    raise notice 'Equipa % tem menos de 7 fakes — peladinhas saltadas.', v_team_id;
  else
    -- ----- 4. Create 5 validated peladinhas, alternating sides for the user -----
    for i in 1..5 loop
      -- skip if we already seeded one with this distinctive note
      if not exists (
        select 1 from public.matches
        where is_internal
          and proposed_by = v_user_id
          and message = format('Peladinha seed #%s', i)
      ) then
        v_my_side := case when i % 2 = 0 then 'A' else 'B' end;
        v_score_a := 5 + (i % 4);                    -- 5..8
        v_score_b := case when v_my_side = 'A'
                          then v_score_a - 1 - (i % 2)  -- user wins on A
                          else v_score_a + 1 + (i % 2)  -- user wins on B
                     end;

        insert into public.matches (
          id, sport_id, scheduled_at, location_name, status,
          proposed_by, message, is_internal,
          side_a_label, side_b_label,
          final_score_a, final_score_b, validated_at, created_at
        ) values (
          uuid_generate_v4(),
          v_sport_id,
          now() - (i || ' days')::interval,
          'Campo da Cidade',
          'validated',
          v_user_id,
          format('Peladinha seed #%s', i),
          true,
          'Coletes', 'Sem Coletes',
          v_score_a, v_score_b,
          now() - (i || ' days')::interval + interval '90 minutes',
          now() - (i || ' days')::interval - interval '2 days'
        ) returning id into v_match_id;

        -- both sides = same team (peladinha rule)
        insert into public.match_sides (match_id, side, team_id, captain_id)
        values (v_match_id, 'A', v_team_id, v_user_id),
               (v_match_id, 'B', v_team_id, v_user_id);

        -- user participates on the chosen side
        insert into public.match_participants (
          match_id, user_id, side, invitation_status, attendance, responded_at
        ) values (
          v_match_id, v_user_id, v_my_side::side, 'accepted', 'attended', now()
        );

        -- 3 fakes on side A (skip user's slot), 3 on side B
        for j in 1..6 loop
          fake_id := v_fakes[j];
          if fake_id is not null and fake_id <> v_user_id then
            insert into public.match_participants (
              match_id, user_id, side, invitation_status, attendance, responded_at
            ) values (
              v_match_id,
              fake_id,
              (case when j <= 3 then (case when v_my_side='A' then 'B' else 'A' end) else v_my_side end)::side,
              'accepted', 'attended', now()
            ) on conflict do nothing;
          end if;
        end loop;

        v_pel_added := v_pel_added + 1;
      end if;
    end loop;

    -- ----- 5. One PENDING peladinha invite (announce-first, user pending) -----
    if not exists (
      select 1 from public.matches
      where is_internal
        and proposed_by = v_fakes[1]
        and message = 'Peladinha seed pendente'
    ) then
      insert into public.matches (
        id, sport_id, scheduled_at, location_name, status,
        proposed_by, message, is_internal,
        side_a_label, side_b_label
      ) values (
        uuid_generate_v4(),
        v_sport_id,
        now() + interval '2 days',
        'Campo da Cidade',
        'proposed',
        v_fakes[1],
        'Peladinha seed pendente',
        true,
        'Coletes', 'Sem Coletes'
      ) returning id into v_match_id;

      insert into public.match_sides (match_id, side, team_id, captain_id) values
        (v_match_id, 'A', v_team_id, v_fakes[1]),
        (v_match_id, 'B', v_team_id, v_fakes[1]);

      -- invite user as PENDING (this is what shows "Peladinhas · 1 por confirmar" on home)
      insert into public.match_participants (match_id, user_id, side, invitation_status)
      values (v_match_id, v_user_id, 'A', 'pending')
      on conflict do nothing;
    end if;
  end if;

  -- ----- 6. Friendships (5 fakes accepted as friends) -----
  if v_fakes is not null then
    for i in 1..least(array_length(v_fakes, 1), 6) loop
      fake_id := v_fakes[i];
      if fake_id <> v_user_id then
        insert into public.friendships (requester_id, addressee_id, status, accepted_at)
        values (v_user_id, fake_id, 'accepted', now() - interval '3 days')
        on conflict (requester_id, addressee_id) do nothing;
        v_friends_added := v_friends_added + 1;
      end if;
    end loop;
  end if;

  -- ----- 7. Team reviews — review opposing teams in past validated competitions -----
  for comp_match in
    select m.id as match_id, ms_opp.team_id as opp_team_id
    from public.matches m
    join public.match_sides ms_me  on ms_me.match_id = m.id and ms_me.team_id = v_team_id
    join public.match_sides ms_opp on ms_opp.match_id = m.id and ms_opp.team_id <> v_team_id
    join public.match_participants mp
      on mp.match_id = m.id and mp.user_id = v_user_id and mp.attendance in ('attended','substitute_in')
    where m.status = 'validated'
      and not coalesce(m.is_internal, false)
    limit 4
  loop
    insert into public.team_reviews (
      match_id, reviewer_id, reviewed_team_id,
      fair_play, punctuality, technical_level,
      visible_at
    ) values (
      comp_match.match_id, v_user_id, comp_match.opp_team_id,
      4 + (v_rev_added % 2),    -- 4 or 5
      4 + ((v_rev_added+1) % 2),
      3 + (v_rev_added % 3),    -- 3,4,5
      now() - interval '1 day'
    ) on conflict (match_id, reviewer_id, reviewed_team_id) do nothing;
    v_rev_added := v_rev_added + 1;
  end loop;

  -- ----- 8. Faceoff votes (user picks winners between his teammates) -----
  if v_fakes is not null and array_length(v_fakes, 1) >= 4 then
    declare
      a uuid; b uuid;
    begin
      for i in 1..4 loop
        a := v_fakes[i];
        b := v_fakes[i + 1];
        if a is not null and b is not null and a <> v_user_id and b <> v_user_id then
          insert into public.team_faceoff_votes (
            team_id, voter_id, player_low, player_high, winner_id
          ) values (
            v_team_id, v_user_id,
            least(a::text, b::text)::uuid,
            greatest(a::text, b::text)::uuid,
            case when i % 2 = 0 then a else b end
          ) on conflict do nothing;
          v_face_added := v_face_added + 1;
        end if;
      end loop;
    end;
  end if;

  raise notice 'SEED FEITO: peladinhas=%, amigos=%, team_reviews=%, faceoffs=%',
    v_pel_added, v_friends_added, v_rev_added, v_face_added;
end;
$$;
-- =============================================================================
-- 0068 — força peladinhas de teste mesmo sem fakes na equipa do user
-- =============================================================================
-- A 0066 saltou se v_team_id não tivesse 7 fakes membros. Agora usa fakes
-- globais (em auth.users com email like 'fake%@jogadalimpa.local') —
-- match_participants não exige membership de team, só participação.
--
-- Também distribui golos/assists pelos participantes para que o
-- threshold IN FORM (3+ G+A em 7 dias) possa disparar no user real.

do $$
declare
  v_user_id   uuid;
  v_team_id   uuid;
  v_sport_id  int;
  v_match_id  uuid;
  v_score_a   int;
  v_score_b   int;
  v_my_side   text;
  v_other     text;
  v_fakes     uuid[];
  v_pel_added int := 0;
  v_frs_added int := 0;
  fake_id     uuid;
  i           int;
  j           int;
  my_goals    int;
  my_assists  int;
begin
  -- 1. user real COM PROFILE (evita signups incompletos)
  select p.id into v_user_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email is not null
    and u.email not like 'fake%@jogadalimpa.local'
    and p.deleted_at is null
  order by p.created_at desc
  limit 1;
  if v_user_id is null then raise notice 'Sem user real com profile.'; return; end if;

  -- 2. team_id: qualquer equipa do user, senão Bombs FC, senão a primeira activa
  select t.id, t.sport_id into v_team_id, v_sport_id
  from public.teams t
  join public.team_members tm on tm.team_id = t.id
  where tm.user_id = v_user_id and t.is_active
  order by t.created_at desc limit 1;

  if v_team_id is null then
    select t.id, t.sport_id into v_team_id, v_sport_id
    from public.teams t
    where t.is_active and lower(t.name) like '%bombs%'
    limit 1;
  end if;

  if v_team_id is null then
    select t.id, t.sport_id into v_team_id, v_sport_id
    from public.teams t where t.is_active order by t.created_at asc limit 1;
  end if;

  if v_team_id is null then raise notice 'Sem equipas activas.'; return; end if;

  -- Adiciona o user como membro dessa equipa caso ainda não esteja
  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_user_id, 'member')
  on conflict (team_id, user_id) do nothing;

  -- 3. fakes COM PROFILE
  select array_agg(p.id order by p.created_at) into v_fakes
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like 'fake%@jogadalimpa.local'
    and p.deleted_at is null
  limit 8;

  if v_fakes is null or array_length(v_fakes, 1) < 6 then
    raise notice 'Menos de 6 fakes com profile — abort.';
    return;
  end if;

  -- 4. Peladinhas (idempotente via message marker novo)
  for i in 1..5 loop
    if exists (
      select 1 from public.matches
      where is_internal and message = format('Peladinha v2 #%s (user=%s)', i, v_user_id)
    ) then
      continue;
    end if;

    v_my_side := case when i % 2 = 0 then 'A' else 'B' end;
    v_other   := case when v_my_side = 'A' then 'B' else 'A' end;
    v_score_a := 5 + (i % 4);
    v_score_b := case when v_my_side = 'A'
                      then v_score_a - 1 - (i % 2)
                      else v_score_a + 1 + (i % 2)
                 end;

    insert into public.matches (
      sport_id, scheduled_at, location_name, status,
      proposed_by, message, is_internal,
      side_a_label, side_b_label,
      final_score_a, final_score_b, validated_at, created_at
    ) values (
      v_sport_id,
      now() - (i || ' days')::interval,
      'Campo da Cidade',
      'validated',
      v_user_id,
      format('Peladinha v2 #%s (user=%s)', i, v_user_id),
      true,
      'Coletes', 'Sem Coletes',
      v_score_a, v_score_b,
      now() - (i || ' days')::interval + interval '90 minutes',
      now() - (i || ' days')::interval - interval '2 days'
    ) returning id into v_match_id;

    insert into public.match_sides (match_id, side, team_id, captain_id)
    values (v_match_id, 'A', v_team_id, v_user_id),
           (v_match_id, 'B', v_team_id, v_user_id);

    -- user no v_my_side, com 1 ou 2 golos + 1 assist (alimenta IN FORM)
    my_goals   := case when i <= 3 then 1 else 2 end;
    my_assists := case when i % 2 = 0 then 1 else 0 end;

    insert into public.match_participants (
      match_id, user_id, side, invitation_status, attendance, responded_at,
      goals, assists
    ) values (
      v_match_id, v_user_id, v_my_side::side, 'accepted', 'attended', now(),
      my_goals, my_assists
    );

    -- 6 fakes — 3 do lado oposto, 3 do mesmo lado do user
    -- distribui os golos restantes entre eles
    for j in 1..6 loop
      fake_id := v_fakes[j];
      if fake_id is not null and fake_id <> v_user_id then
        insert into public.match_participants (
          match_id, user_id, side, invitation_status, attendance, responded_at,
          goals, assists
        ) values (
          v_match_id, fake_id,
          (case when j <= 3 then v_other else v_my_side end)::side,
          'accepted', 'attended', now(),
          (case when j <= 2 then 1 else 0 end),  -- 2 fakes adversários com 1 golo
          (case when j = 4 then 1 else 0 end)    -- 1 fake do meu lado com assist
        ) on conflict do nothing;
      end if;
    end loop;

    v_pel_added := v_pel_added + 1;
  end loop;

  -- 5. Friendships fallback (caso a 0066 não tenha adicionado)
  for i in 1..least(array_length(v_fakes, 1), 6) loop
    fake_id := v_fakes[i];
    if fake_id <> v_user_id then
      insert into public.friendships (requester_id, addressee_id, status, accepted_at)
      values (v_user_id, fake_id, 'accepted', now() - interval '3 days')
      on conflict (requester_id, addressee_id) do nothing;
      v_frs_added := v_frs_added + 1;
    end if;
  end loop;

  raise notice 'PELADINHA SEED v2: peladinhas=%, friendships=%, team=%',
    v_pel_added, v_frs_added, v_team_id;
end $$;
