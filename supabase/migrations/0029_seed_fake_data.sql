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
