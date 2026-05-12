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
