-- =============================================================================
-- APPLE REVIEWER SEED — clean realistic data for App Review
-- =============================================================================
-- Creates a test account + supporting data so the reviewer sees a live app.
-- Test credentials (provide in App Review Information / Notes):
--   Email:    reviewer@s7vn.app
--   Password: S7vnReview2026!
--
-- Idempotent. Safe to re-run.

do $$
declare
  v_pwd text := crypt('S7vnReview2026!', gen_salt('bf'));
  v_pwd_fake text := crypt('FakePassword123', gen_salt('bf'));

  -- Reviewer + 13 realistic fakes
  v_rev  uuid := '11111111-aaaa-4000-8000-000000000001';
  v_p1   uuid := '11111111-aaaa-4000-8000-000000000002';
  v_p2   uuid := '11111111-aaaa-4000-8000-000000000003';
  v_p3   uuid := '11111111-aaaa-4000-8000-000000000004';
  v_p4   uuid := '11111111-aaaa-4000-8000-000000000005';
  v_p5   uuid := '11111111-aaaa-4000-8000-000000000006';
  v_p6   uuid := '11111111-aaaa-4000-8000-000000000007';
  v_p7   uuid := '11111111-aaaa-4000-8000-000000000008';
  v_p8   uuid := '11111111-aaaa-4000-8000-000000000009';
  v_p9   uuid := '11111111-aaaa-4000-8000-000000000010';
  v_p10  uuid := '11111111-aaaa-4000-8000-000000000011';
  v_p11  uuid := '11111111-aaaa-4000-8000-000000000012';
  v_p12  uuid := '11111111-aaaa-4000-8000-000000000013';
  v_p13  uuid := '11111111-aaaa-4000-8000-000000000014';

  v_t1   uuid := '22222222-aaaa-4000-8000-000000000001'; -- Reviewer's team
  v_t2   uuid := '22222222-aaaa-4000-8000-000000000002';

  v_m1   uuid := '33333333-aaaa-4000-8000-000000000001';
  v_m2   uuid := '33333333-aaaa-4000-8000-000000000002';
begin
  -- ============================ AUTH USERS ============================
  -- NOTA: email_change, email_change_token_new, email_change_token_current,
  -- recovery_token, confirmation_token, reauthentication_token, phone_change,
  -- phone_change_token são preenchidos a '' explicitamente. Mesmo que sejam
  -- NULL-permissivos no Postgres, GoTrue rejeita NULL aqui e devolve
  -- "Database error querying schema" no /token. raw_app_meta_data tem
  -- providers:["email"] pelo mesmo motivo. Ver 0087_reviewer_identities.sql.
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    email_change, email_change_token_new, email_change_token_current,
    recovery_token, confirmation_token, reauthentication_token,
    phone_change, phone_change_token
  ) values
    (v_rev, '00000000-0000-0000-0000-000000000000', 'reviewer@s7vn.app',  v_pwd,      now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p1,  '00000000-0000-0000-0000-000000000000', 'jmarques@s7vn.local', v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p2,  '00000000-0000-0000-0000-000000000000', 'psantos@s7vn.local',  v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p3,  '00000000-0000-0000-0000-000000000000', 'tferreira@s7vn.local', v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p4,  '00000000-0000-0000-0000-000000000000', 'mcosta@s7vn.local',   v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p5,  '00000000-0000-0000-0000-000000000000', 'apinto@s7vn.local',   v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p6,  '00000000-0000-0000-0000-000000000000', 'rsilva@s7vn.local',   v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p7,  '00000000-0000-0000-0000-000000000000', 'balmeida@s7vn.local', v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p8,  '00000000-0000-0000-0000-000000000000', 'dsousa@s7vn.local',   v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p9,  '00000000-0000-0000-0000-000000000000', 'roliveira@s7vn.local', v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p10, '00000000-0000-0000-0000-000000000000', 'fmoreira@s7vn.local', v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p11, '00000000-0000-0000-0000-000000000000', 'gmartins@s7vn.local', v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p12, '00000000-0000-0000-0000-000000000000', 'hcarvalho@s7vn.local', v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', ''),
    (v_p13, '00000000-0000-0000-0000-000000000000', 'ngomes@s7vn.local',   v_pwd_fake, now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', '')
  on conflict (id) do nothing;

  -- ============================ AUTH IDENTITIES ============================
  -- GoTrue v2 exige row em auth.identities para login por password. Sem
  -- isto, /token devolve "Database error querying schema" (foi o que partiu
  -- a App Review do build #4 — ver 0087_reviewer_identities.sql).
  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  select
    gen_random_uuid(),
    u.id::text,
    u.id,
    jsonb_build_object(
      'sub',            u.id::text,
      'email',          u.email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(), now(), now()
  from auth.users u
  where u.id in (v_rev, v_p1, v_p2, v_p3, v_p4, v_p5, v_p6, v_p7,
                 v_p8, v_p9, v_p10, v_p11, v_p12, v_p13)
    and not exists (
      select 1 from auth.identities i
      where i.user_id = u.id and i.provider = 'email'
    );

  -- ============================ PROFILES ============================
  insert into public.profiles (id, name, photo_url, city, birthdate, bio) values
    (v_rev, 'App Reviewer', 'https://i.pravatar.cc/200?img=15', 'Coimbra', '1995-06-15', 'Conta de teste para revisão da App Store.'),
    (v_p1,  'João Marques',    'https://i.pravatar.cc/200?img=12', 'Coimbra', '1995-04-20', 'Médio criativo. Passe longo é a minha cena.'),
    (v_p2,  'Pedro Santos',    'https://i.pravatar.cc/200?img=33', 'Coimbra', '1993-11-08', 'Avançado. Boa finalização dentro da área.'),
    (v_p3,  'Tiago Ferreira',  'https://i.pravatar.cc/200?img=51', 'Coimbra', '1997-02-14', 'Guarda-redes. 1.88m, bom no jogo de pés.'),
    (v_p4,  'Miguel Costa',    'https://i.pravatar.cc/200?img=8',  'Coimbra', '1994-07-30', 'Defesa central. Sólido no duelo aéreo.'),
    (v_p5,  'André Pinto',     'https://i.pravatar.cc/200?img=68', 'Coimbra', '1996-09-12', 'Lateral direito. Suporta ataque-defesa.'),
    (v_p6,  'Ricardo Silva',   'https://i.pravatar.cc/200?img=14', 'Coimbra', '1992-12-05', 'Avançado, 33 anos, ainda com gás.'),
    (v_p7,  'Bruno Almeida',   'https://i.pravatar.cc/200?img=53', 'Coimbra', '1998-03-21', 'Médio defensivo. Ler o jogo, ganhar bolas.'),
    (v_p8,  'Diogo Sousa',     'https://i.pravatar.cc/200?img=11', 'Coimbra', '1995-08-17', 'Defesa esquerdo. Subo na linha sempre que posso.'),
    (v_p9,  'Rui Oliveira',    'https://i.pravatar.cc/200?img=60', 'Coimbra', '1991-01-26', 'Médio centro. Distribuo o jogo.'),
    (v_p10, 'Filipe Moreira',  'https://i.pravatar.cc/200?img=22', 'Coimbra', '1996-05-09', 'Avançado-extremo, esquerdino.'),
    (v_p11, 'Gonçalo Martins', 'https://i.pravatar.cc/200?img=58', 'Coimbra', '1994-10-03', 'Defesa polivalente, central ou lateral.'),
    (v_p12, 'Henrique Carvalho','https://i.pravatar.cc/200?img=64','Coimbra', '1993-06-28', 'GR/jogador de campo. Versátil.'),
    (v_p13, 'Nuno Gomes',      'https://i.pravatar.cc/200?img=43', 'Coimbra', '1997-12-19', 'Médio ofensivo. Último passe.')
  on conflict (id) do nothing;

  -- ============================ USER_SPORTS ============================
  insert into public.user_sports (user_id, sport_id, declared_level, elo, matches_played, preferred_position) values
    (v_rev, 2, 6, 1280,  4, 'med'),
    (v_p1,  2, 7, 1340, 12, 'med'),
    (v_p2,  2, 8, 1410, 14, 'ata'),
    (v_p3,  2, 6, 1280, 10, 'gr'),
    (v_p4,  2, 7, 1320,  8, 'def'),
    (v_p5,  2, 6, 1250,  7, 'def'),
    (v_p6,  2, 7, 1310, 11, 'ata'),
    (v_p7,  2, 6, 1240,  6, 'med'),
    (v_p8,  2, 7, 1290,  8, 'def'),
    (v_p9,  2, 8, 1380, 13, 'med'),
    (v_p10, 2, 7, 1320,  9, 'ata'),
    (v_p11, 2, 6, 1230,  6, 'def'),
    (v_p12, 2, 5, 1180,  4, 'gr'),
    (v_p13, 2, 7, 1300,  9, 'med')
  on conflict (user_id, sport_id) do nothing;

  -- ============================ TEAMS ============================
  insert into public.teams (id, name, photo_url, sport_id, city, captain_id, description, is_active) values
    (v_t1, 'Coimbra United',    'https://api.dicebear.com/7.x/shapes/png?seed=CoimbraUnited',    2, 'Coimbra', v_rev, 'Equipa de F7 que joga aos sábados no Pavilhão de Solum.', true),
    (v_t2, 'Académica Veteranos','https://api.dicebear.com/7.x/shapes/png?seed=AcademicaVet',     2, 'Coimbra', v_p2,  'Antigos colegas de faculdade que mantêm o ritmo. Estádio Académica.', true)
  on conflict (id) do nothing;

  -- ============================ TEAM_MEMBERS (14 in v_t1, 14 in v_t2) ============================
  insert into public.team_members (team_id, user_id, role) values
    -- Coimbra United (Reviewer is captain)
    (v_t1, v_rev, 'captain'),
    (v_t1, v_p1,  'member'),
    (v_t1, v_p3,  'member'),
    (v_t1, v_p4,  'member'),
    (v_t1, v_p5,  'member'),
    (v_t1, v_p7,  'member'),
    (v_t1, v_p8,  'member'),
    (v_t1, v_p9,  'member'),
    (v_t1, v_p11, 'member'),
    (v_t1, v_p13, 'member'),
    -- and 4 cross-team (also in v_t2)
    (v_t1, v_p2,  'member'),
    (v_t1, v_p6,  'member'),
    (v_t1, v_p10, 'member'),
    (v_t1, v_p12, 'member'),
    -- Académica Veteranos
    (v_t2, v_p2,  'captain'),
    (v_t2, v_p6,  'member'),
    (v_t2, v_p10, 'member'),
    (v_t2, v_p12, 'member'),
    (v_t2, v_p1,  'member'),
    (v_t2, v_p3,  'member'),
    (v_t2, v_p4,  'member'),
    (v_t2, v_p5,  'member'),
    (v_t2, v_p7,  'member'),
    (v_t2, v_p8,  'member'),
    (v_t2, v_p9,  'member'),
    (v_t2, v_p11, 'member'),
    (v_t2, v_p13, 'member'),
    (v_t2, v_rev, 'member')
  on conflict (team_id, user_id) do nothing;

  -- ============================ MATCHES (2 validated) ============================
  insert into public.matches (
    id, sport_id, scheduled_at, location_name, location_tbd,
    status, proposed_by, final_score_a, final_score_b, validated_at
  ) values
    (v_m1, 2, now() - interval '14 days', 'Pavilhão Solum', false, 'validated', v_rev, 3, 2, now() - interval '14 days'),
    (v_m2, 2, now() - interval  '7 days', 'Estádio Académica', false, 'validated', v_p2,  2, 2, now() - interval '7 days')
  on conflict (id) do nothing;

  insert into public.match_sides (match_id, side, team_id, captain_id) values
    (v_m1, 'A', v_t1, v_rev), (v_m1, 'B', v_t2, v_p2),
    (v_m2, 'A', v_t2, v_p2),  (v_m2, 'B', v_t1, v_rev)
  on conflict (match_id, side) do nothing;

  -- 7 attended per side per match
  insert into public.match_participants (match_id, user_id, side, invitation_status, attendance, goals, assists) values
    -- m1 — side A (Coimbra United) won 3-2
    (v_m1, v_rev, 'A', 'accepted', 'attended', 1, 1),
    (v_m1, v_p1,  'A', 'accepted', 'attended', 1, 0),
    (v_m1, v_p3,  'A', 'accepted', 'attended', 0, 0),
    (v_m1, v_p4,  'A', 'accepted', 'attended', 0, 1),
    (v_m1, v_p5,  'A', 'accepted', 'attended', 0, 0),
    (v_m1, v_p7,  'A', 'accepted', 'attended', 1, 0),
    (v_m1, v_p9,  'A', 'accepted', 'attended', 0, 1),
    -- m1 — side B
    (v_m1, v_p2,  'B', 'accepted', 'attended', 1, 0),
    (v_m1, v_p6,  'B', 'accepted', 'attended', 1, 1),
    (v_m1, v_p8,  'B', 'accepted', 'attended', 0, 0),
    (v_m1, v_p10, 'B', 'accepted', 'attended', 0, 1),
    (v_m1, v_p11, 'B', 'accepted', 'attended', 0, 0),
    (v_m1, v_p12, 'B', 'accepted', 'attended', 0, 0),
    (v_m1, v_p13, 'B', 'accepted', 'attended', 0, 0),
    -- m2 — side A (Académica Veteranos) 2-2 draw
    (v_m2, v_p2,  'A', 'accepted', 'attended', 1, 0),
    (v_m2, v_p6,  'A', 'accepted', 'attended', 1, 1),
    (v_m2, v_p10, 'A', 'accepted', 'attended', 0, 1),
    (v_m2, v_p12, 'A', 'accepted', 'attended', 0, 0),
    (v_m2, v_p11, 'A', 'accepted', 'attended', 0, 0),
    (v_m2, v_p8,  'A', 'accepted', 'attended', 0, 0),
    (v_m2, v_p4,  'A', 'accepted', 'attended', 0, 0),
    -- m2 — side B (Coimbra United)
    (v_m2, v_rev, 'B', 'accepted', 'attended', 1, 0),
    (v_m2, v_p1,  'B', 'accepted', 'attended', 1, 1),
    (v_m2, v_p3,  'B', 'accepted', 'attended', 0, 0),
    (v_m2, v_p5,  'B', 'accepted', 'attended', 0, 0),
    (v_m2, v_p7,  'B', 'accepted', 'attended', 0, 1),
    (v_m2, v_p9,  'B', 'accepted', 'attended', 0, 0),
    (v_m2, v_p13, 'B', 'accepted', 'attended', 0, 0)
  on conflict (match_id, user_id) do nothing;
end $$;

-- ============================ PLAYER STATS ============================
-- Position-based votes for every fake — keeps stats visible on profiles
do $$
declare
  target_rec record;
  voter_rec record;
  base_pace int;
  base_shoot int;
  base_drib int;
  base_pass int;
  base_def int;
  base_phy int;
begin
  for target_rec in
    select p.id, coalesce(us.preferred_position, 'med') as pos
    from public.profiles p
    left join public.user_sports us on us.user_id = p.id and us.sport_id = 2
    where p.id::text like '11111111-aaaa-4000-8000-%'
      and p.deleted_at is null
  loop
    case target_rec.pos
      when 'gr'  then base_pace := 50; base_shoot := 35; base_drib := 40; base_pass := 55; base_def := 78; base_phy := 75;
      when 'def' then base_pace := 64; base_shoot := 55; base_drib := 58; base_pass := 68; base_def := 80; base_phy := 78;
      when 'med' then base_pace := 72; base_shoot := 70; base_drib := 76; base_pass := 82; base_def := 62; base_phy := 70;
      when 'ata' then base_pace := 82; base_shoot := 84; base_drib := 80; base_pass := 66; base_def := 50; base_phy := 72;
      else            base_pace := 68; base_shoot := 65; base_drib := 68; base_pass := 68; base_def := 62; base_phy := 68;
    end case;

    -- Self-vote
    insert into public.player_stat_votes (voter_id, target_id, category, value) values
      (target_rec.id, target_rec.id, 'velocidade', base_pace),
      (target_rec.id, target_rec.id, 'remate',     base_shoot),
      (target_rec.id, target_rec.id, 'drible',     base_drib),
      (target_rec.id, target_rec.id, 'passe',      base_pass),
      (target_rec.id, target_rec.id, 'defesa',     base_def),
      (target_rec.id, target_rec.id, 'fisico',     base_phy)
    on conflict do nothing;

    -- 4 teammate votes
    for voter_rec in
      select p.id from public.profiles p
      where p.id::text like '11111111-aaaa-4000-8000-%'
        and p.id <> target_rec.id
        and p.deleted_at is null
      order by random()
      limit 4
    loop
      insert into public.player_stat_votes (voter_id, target_id, category, value) values
        (voter_rec.id, target_rec.id, 'velocidade', greatest(1, least(99, base_pace  + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'remate',     greatest(1, least(99, base_shoot + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'drible',     greatest(1, least(99, base_drib  + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'passe',      greatest(1, least(99, base_pass  + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'defesa',     greatest(1, least(99, base_def   + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'fisico',     greatest(1, least(99, base_phy   + (random() * 10 - 5)::int)))
      on conflict do nothing;
    end loop;
  end loop;
end $$;

-- ============================ VERIFY ============================
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from profiles) as profiles,
  (select count(*) from teams) as teams,
  (select count(*) from team_members) as memberships,
  (select count(*) from matches where status = 'validated') as matches_validated,
  (select count(*) from match_participants where attendance = 'attended') as participants_attended,
  (select count(*) from player_stat_votes) as stat_votes;
