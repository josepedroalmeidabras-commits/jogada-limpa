-- =============================================================================
-- Jogada Limpa — Migrations PENDENTES (0033 → 0037)
-- =============================================================================
-- 0033 — jersey + nickname + preferred_foot em profiles
-- 0034 — 5 valores GK no enum player_stat_category
-- 0035 — matches.referee_id + set_match_referee + submit_referee_review
-- 0036 — seed boost: Bombs FC com 16 membros para peladinhas 8v8
-- 0037 — announce-first peladinhas + coach opcional na equipa
-- =============================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0033_profile_personalisation.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- PROFILE PERSONALISATION
-- =============================================================================
-- Adiciona campos opcionais que dão personalidade ao perfil sem inflar schema:
--   jersey_number  — número de camisola 1-99
--   nickname       — alcunha de campo (≤ 20 chars), aparece em "João «Bombas» Marques"
--   preferred_foot — pé preferido (left, right, both)

alter table public.profiles
  add column if not exists jersey_number  smallint check (jersey_number between 1 and 99),
  add column if not exists nickname       text     check (char_length(nickname) <= 20),
  add column if not exists preferred_foot text     check (preferred_foot in ('left','right','both'));


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0034_goalkeeper_stats.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- GOALKEEPER STATS
-- =============================================================================
-- Adiciona 5 valores novos ao enum `player_stat_category` para guarda-redes.
-- Outfielders continuam com os 6 valores existentes (velocidade, remate,
-- drible, passe, defesa, físico). GKs usam o set:
--   reflexos · defesa_aerea · posicionamento · distribuicao · saidas · fisico
--
-- Ambos partilham `fisico`. A diferenciação é client-side: o componente
-- PlayerStatsCard escolhe quais 6 mostrar consoante `preferred_position`.

alter type public.player_stat_category add value if not exists 'reflexos';
alter type public.player_stat_category add value if not exists 'defesa_aerea';
alter type public.player_stat_category add value if not exists 'posicionamento';
alter type public.player_stat_category add value if not exists 'distribuicao';
alter type public.player_stat_category add value if not exists 'saidas';


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0035_referee.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- OPTIONAL REFEREE
-- =============================================================================
-- Sempre opcional — a maioria dos jogos amadores não tem árbitro.
-- Quando há, qualquer profile (incluindo um jogador "convidado") pode ser o
-- árbitro. Reviews ao árbitro usam o role='referee' já existente no enum.

alter table public.matches
  add column if not exists referee_id uuid references public.profiles(id);

create index if not exists idx_matches_referee on public.matches(referee_id) where referee_id is not null;


-- ============================ set_match_referee ============================
create or replace function public.set_match_referee(
  p_match_id   uuid,
  p_referee_id uuid  -- null para limpar
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_status match_status;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if v_status in ('cancelled') then
    raise exception 'Match is cancelled';
  end if;

  if not exists (
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) then
    raise exception 'Only an involved captain can set the referee';
  end if;

  if p_referee_id is not null and not exists (
    select 1 from public.profiles where id = p_referee_id and deleted_at is null
  ) then
    raise exception 'Referee profile not found';
  end if;

  update public.matches
    set referee_id = p_referee_id
    where id = p_match_id;
end;
$$;

revoke all on function public.set_match_referee(uuid, uuid) from public, anon;
grant execute on function public.set_match_referee(uuid, uuid) to authenticated;


-- ============================ submit_referee_review =======================
-- Quem participou (qualquer lado) pode avaliar o árbitro depois do jogo
-- validado. Reutiliza a tabela reviews, role='referee'.
create or replace function public.submit_referee_review(
  p_match_id        uuid,
  p_fair_play       int,
  p_punctuality     int,
  p_technical_level int,
  p_attitude        int,
  p_comment         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_match      record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select id, status, referee_id into v_match
    from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if v_match.referee_id is null then
    raise exception 'This match has no referee';
  end if;
  if v_match.referee_id = v_user then
    raise exception 'Cannot review yourself as the referee';
  end if;
  if v_match.status <> 'validated' then
    raise exception 'Match must be validated first';
  end if;

  -- must have attended the match
  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = v_user
      and attendance in ('attended', 'substitute_in')
  ) then
    raise exception 'Only players who attended can review the referee';
  end if;

  insert into public.reviews(
    match_id, reviewer_id, reviewed_id, role,
    fair_play, punctuality, technical_level, attitude, comment,
    visible_at
  )
  values (
    p_match_id, v_user, v_match.referee_id, 'referee'::review_role,
    least(5, greatest(1, p_fair_play)),
    least(5, greatest(1, p_punctuality)),
    least(5, greatest(1, p_technical_level)),
    least(5, greatest(1, p_attitude)),
    nullif(trim(p_comment), ''),
    now()
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.submit_referee_review(uuid, int, int, int, int, text) from public, anon;
grant execute on function public.submit_referee_review(uuid, int, int, int, int, text) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0036_bigger_bombs_fc.sql
-- ──────────────────────────────────────────────────────────────────────────

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


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0037_announce_peladinha_and_coach.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- ANNOUNCE-FIRST PELADINHAS + OPTIONAL TEAM COACH
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Coach opcional na equipa
-- ----------------------------------------------------------------------------
alter table public.teams
  add column if not exists coach_id uuid references public.profiles(id);

create index if not exists idx_teams_coach on public.teams(coach_id) where coach_id is not null;


-- ============================ set_team_coach ===============================
create or replace function public.set_team_coach(
  p_team_id  uuid,
  p_coach_id uuid  -- null para remover
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_team from public.teams where id = p_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;
  if v_team.captain_id <> v_user then
    raise exception 'Only the captain can set the coach';
  end if;

  if p_coach_id is not null and not exists (
    select 1 from public.profiles where id = p_coach_id and deleted_at is null
  ) then
    raise exception 'Coach profile not found';
  end if;

  update public.teams set coach_id = p_coach_id where id = p_team_id;
end;
$$;

revoke all on function public.set_team_coach(uuid, uuid) from public, anon;
grant execute on function public.set_team_coach(uuid, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Announce-first peladinhas
-- ----------------------------------------------------------------------------
-- Capitão "anuncia" a peladinha; todos os membros são convidados
-- automaticamente com invitation_status='pending' e side='A' (placeholder).
-- Cada membro responde via UPDATE direto em match_participants (já permitido
-- pela policy mp_respond). Depois, o capitão usa assign_internal_sides para
-- dividir os que confirmaram em A e B.

create or replace function public.announce_internal_match(
  p_team_id       uuid,
  p_scheduled_at  timestamptz,
  p_location_name text default null,
  p_location_tbd  boolean default false,
  p_notes         text default null,
  p_side_a_label  text default null,
  p_side_b_label  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_team  record;
  v_match uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_scheduled_at is null then raise exception 'Scheduled date required'; end if;

  select * into v_team from public.teams where id = p_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;
  if v_team.captain_id <> v_user then
    raise exception 'Only the team captain can announce peladinhas';
  end if;

  insert into public.matches(
    sport_id, scheduled_at, location_name, location_tbd, status,
    proposed_by, notes, is_internal, side_a_label, side_b_label
  ) values (
    v_team.sport_id, p_scheduled_at, p_location_name, coalesce(p_location_tbd, false),
    'confirmed', v_user, p_notes, true,
    coalesce(nullif(trim(p_side_a_label), ''), 'Coletes'),
    coalesce(nullif(trim(p_side_b_label), ''), 'Sem coletes')
  )
  returning id into v_match;

  insert into public.match_sides(match_id, side, team_id, captain_id) values
    (v_match, 'A', p_team_id, v_user),
    (v_match, 'B', p_team_id, v_user);

  -- invite every active member (side='A' is placeholder until captain splits)
  insert into public.match_participants(match_id, user_id, side, invitation_status, attendance)
  select v_match, tm.user_id, 'A'::side, 'pending'::invitation_status, null
  from public.team_members tm
  where tm.team_id = p_team_id;

  -- in-app notification rows (push fan-out happens client-side)
  insert into public.notifications(user_id, type, title, body, payload, channel)
  select
    tm.user_id,
    'peladinha_invite',
    'Peladinha marcada',
    coalesce(v_team.name, 'A tua equipa') || ' marcou peladinha em ' ||
      to_char(p_scheduled_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI'),
    jsonb_build_object('match_id', v_match::text, 'team_id', p_team_id::text),
    'in_app'
  from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id <> v_user;

  return v_match;
end;
$$;

revoke all on function public.announce_internal_match(uuid, timestamptz, text, boolean, text, text, text) from public, anon;
grant execute on function public.announce_internal_match(uuid, timestamptz, text, boolean, text, text, text) to authenticated;


-- ============================ assign_internal_sides ========================
-- Captain divides the confirmed players between A and B. Players who
-- declined or remained pending and weren't included stay as 'missed' once
-- the result is submitted.
create or replace function public.assign_internal_sides(
  p_match_id        uuid,
  p_side_a_user_ids uuid[],
  p_side_b_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_uid  uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) then
    raise exception 'Only the captain can split sides';
  end if;

  -- a player cannot be on both sides
  if exists (
    select 1 from unnest(p_side_a_user_ids) a
    where a = any (p_side_b_user_ids)
  ) then
    raise exception 'A player cannot be on both sides';
  end if;

  foreach v_uid in array p_side_a_user_ids loop
    update public.match_participants
      set side = 'A'::side
      where match_id = p_match_id and user_id = v_uid;
  end loop;

  foreach v_uid in array p_side_b_user_ids loop
    update public.match_participants
      set side = 'B'::side
      where match_id = p_match_id and user_id = v_uid;
  end loop;
end;
$$;

revoke all on function public.assign_internal_sides(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.assign_internal_sides(uuid, uuid[], uuid[]) to authenticated;
