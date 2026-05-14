-- =============================================================================
-- SUB-CAPTAINS (1 capitão + até 2 sub-capitães por equipa)
-- =============================================================================
-- Cada equipa pode ter até 2 sub-capitães. Sub-capitão tem as mesmas
-- permissões do capitão para AGENDAR (propor jogos, peladinhas, desafios
-- abertos, pedidos de substituto). Continuam reservados ao capitão:
-- cancelar/reagendar jogo, definir treinador, fixar avisos, atribuir
-- sub-capitães, eliminar equipa.

-- ----------------------------------------------------------------------------
-- 1. Colunas na tabela teams
-- ----------------------------------------------------------------------------
alter table public.teams
  add column if not exists sub_captain_1_id uuid references public.profiles(id) on delete set null,
  add column if not exists sub_captain_2_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_teams_sub1 on public.teams(sub_captain_1_id) where sub_captain_1_id is not null;
create index if not exists idx_teams_sub2 on public.teams(sub_captain_2_id) where sub_captain_2_id is not null;


-- ----------------------------------------------------------------------------
-- 2. Helper: is_team_leader (captain OR sub-captain)
-- ----------------------------------------------------------------------------
create or replace function public.is_team_leader(
  p_team_id uuid,
  p_user_id uuid
) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team_id
      and (
        t.captain_id      = p_user_id or
        t.sub_captain_1_id = p_user_id or
        t.sub_captain_2_id = p_user_id
      )
  );
$$;

revoke all on function public.is_team_leader(uuid, uuid) from public, anon;
grant execute on function public.is_team_leader(uuid, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. set_team_sub_captains (capitão atribui até 2 sub-capitães)
-- ----------------------------------------------------------------------------
create or replace function public.set_team_sub_captains(
  p_team_id uuid,
  p_sub_1   uuid,  -- null para limpar
  p_sub_2   uuid
) returns void
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
    raise exception 'Only the captain can set sub-captains';
  end if;

  -- não pode ser o próprio capitão
  if p_sub_1 is not null and p_sub_1 = v_team.captain_id then
    raise exception 'Sub-captain cannot be the captain';
  end if;
  if p_sub_2 is not null and p_sub_2 = v_team.captain_id then
    raise exception 'Sub-captain cannot be the captain';
  end if;

  -- os dois sub-capitães têm de ser diferentes
  if p_sub_1 is not null and p_sub_2 is not null and p_sub_1 = p_sub_2 then
    raise exception 'Sub-captains must be different';
  end if;

  -- ambos têm de ser membros da equipa
  if p_sub_1 is not null and not exists (
    select 1 from public.team_members where team_id = p_team_id and user_id = p_sub_1
  ) then
    raise exception 'Sub-captain 1 is not a team member';
  end if;
  if p_sub_2 is not null and not exists (
    select 1 from public.team_members where team_id = p_team_id and user_id = p_sub_2
  ) then
    raise exception 'Sub-captain 2 is not a team member';
  end if;

  update public.teams
     set sub_captain_1_id = p_sub_1,
         sub_captain_2_id = p_sub_2
   where id = p_team_id;
end;
$$;

revoke all on function public.set_team_sub_captains(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_team_sub_captains(uuid, uuid, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Extender propose_match para aceitar sub-capitães
-- ----------------------------------------------------------------------------
create or replace function public.propose_match(
  p_proposing_team_id uuid,
  p_opponent_team_id  uuid,
  p_scheduled_at      timestamptz,
  p_location_name     text default null,
  p_location_tbd      boolean default false,
  p_message           text default null,
  p_notes             text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposer       uuid := auth.uid();
  v_proposing_team record;
  v_opponent_team  record;
  v_match_id       uuid;
begin
  if v_proposer is null then raise exception 'Not authenticated'; end if;

  select * into v_proposing_team
    from public.teams
   where id = p_proposing_team_id and is_active;
  if not found then raise exception 'Proposing team not found'; end if;

  if not public.is_team_leader(p_proposing_team_id, v_proposer) then
    raise exception 'Only the captain or sub-captain can propose';
  end if;

  select * into v_opponent_team
    from public.teams
   where id = p_opponent_team_id and is_active;
  if not found then raise exception 'Opponent team not found'; end if;

  if v_proposing_team.sport_id <> v_opponent_team.sport_id then
    raise exception 'Teams must play the same sport';
  end if;

  insert into public.matches(
    sport_id, scheduled_at, location_name, location_tbd,
    status, proposed_by, message, notes
  )
  values (
    v_proposing_team.sport_id, p_scheduled_at, p_location_name, coalesce(p_location_tbd, false),
    'proposed', v_proposer, p_message, p_notes
  )
  returning id into v_match_id;

  -- match_sides.captain_id continua a ser o capitão "oficial" da equipa,
  -- mesmo que tenha sido o sub-capitão a propor. Mantém checks de cancel/
  -- reschedule simples sem alterar 0017.
  insert into public.match_sides(match_id, side, team_id, captain_id) values
    (v_match_id, 'A', p_proposing_team_id, v_proposing_team.captain_id),
    (v_match_id, 'B', p_opponent_team_id,  v_opponent_team.captain_id);

  return v_match_id;
end;
$$;

revoke all on function public.propose_match(uuid, uuid, timestamptz, text, boolean, text, text)
  from public, anon;
grant execute on function public.propose_match(uuid, uuid, timestamptz, text, boolean, text, text)
  to authenticated;


-- ----------------------------------------------------------------------------
-- 5. announce_internal_match aceita sub-capitães
-- ----------------------------------------------------------------------------
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

  if not public.is_team_leader(p_team_id, v_user) then
    raise exception 'Only the captain or sub-captain can announce peladinhas';
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
    (v_match, 'A', p_team_id, v_team.captain_id),
    (v_match, 'B', p_team_id, v_team.captain_id);

  insert into public.match_participants(match_id, user_id, side, invitation_status, attendance)
  select v_match, tm.user_id, 'A'::side, 'pending'::invitation_status, null
  from public.team_members tm
  where tm.team_id = p_team_id;

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


-- ----------------------------------------------------------------------------
-- 6. post_open_match_request aceita sub-capitães
-- ----------------------------------------------------------------------------
create or replace function public.post_open_match_request(
  p_team_id       uuid,
  p_scheduled_at  timestamptz,
  p_location_name text default null,
  p_location_tbd  boolean default false,
  p_notes         text default null,
  p_min_elo       int default null,
  p_max_elo       int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team record;
  v_id   uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_scheduled_at <= now() then
    raise exception 'Scheduled date must be in the future';
  end if;

  select * into v_team from public.teams where id = p_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;

  if not public.is_team_leader(p_team_id, v_user) then
    raise exception 'Only the captain or sub-captain can post';
  end if;

  insert into public.open_match_requests(
    team_id, sport_id, city, scheduled_at,
    location_name, location_tbd, notes,
    min_elo, max_elo, created_by
  )
  values (
    p_team_id, v_team.sport_id, v_team.city, p_scheduled_at,
    p_location_name, coalesce(p_location_tbd, false), p_notes,
    p_min_elo, p_max_elo, v_user
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.post_open_match_request(uuid, timestamptz, text, boolean, text, int, int) from public, anon;
grant execute on function public.post_open_match_request(uuid, timestamptz, text, boolean, text, int, int) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. accept_open_match_request aceita sub-capitães
-- ----------------------------------------------------------------------------
create or replace function public.accept_open_match_request(
  p_request_id uuid,
  p_my_team_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_req       record;
  v_my_team   record;
  v_match_id  uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_req from public.open_match_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'open' then raise exception 'Request is no longer open'; end if;
  if v_req.scheduled_at <= now() then
    raise exception 'Request has already passed';
  end if;

  select * into v_my_team from public.teams where id = p_my_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;

  if not public.is_team_leader(p_my_team_id, v_user) then
    raise exception 'Only the captain or sub-captain can accept';
  end if;
  if v_my_team.id = v_req.team_id then
    raise exception 'Cannot accept your own request';
  end if;
  if v_my_team.sport_id <> v_req.sport_id then
    raise exception 'Sport mismatch';
  end if;

  insert into public.matches(
    sport_id, scheduled_at, location_name, location_tbd,
    status, proposed_by, message, notes
  )
  values (
    v_req.sport_id,
    v_req.scheduled_at,
    v_req.location_name,
    v_req.location_tbd,
    'confirmed',
    v_req.created_by,
    null,
    v_req.notes
  )
  returning id into v_match_id;

  insert into public.match_sides(match_id, side, team_id, captain_id) values
    (v_match_id, 'A', v_req.team_id,  v_req.created_by),
    (v_match_id, 'B', p_my_team_id,   v_my_team.captain_id);

  update public.open_match_requests
     set status = 'matched',
         matched_team_id = p_my_team_id,
         match_id = v_match_id,
         matched_at = now()
   where id = p_request_id;

  insert into public.notifications(user_id, type, title, body, payload, channel)
  values (
    v_req.created_by,
    'open_match_accepted',
    'Desafio aceite',
    coalesce(v_my_team.name || ' aceitou o teu desafio aberto', 'Alguém aceitou o teu desafio'),
    jsonb_build_object('match_id', v_match_id::text, 'request_id', p_request_id::text),
    'in_app'
  );

  return v_match_id;
end;
$$;

revoke all on function public.accept_open_match_request(uuid, uuid) from public, anon;
grant execute on function public.accept_open_match_request(uuid, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 8. post_substitute_request aceita sub-capitães
-- ----------------------------------------------------------------------------
create or replace function public.post_substitute_request(
  p_match_id    uuid,
  p_side        text,
  p_position    text default null,
  p_count       int default 1,
  p_notes       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_match record;
  v_team  record;
  v_id    uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_side not in ('A','B') then raise exception 'Invalid side'; end if;
  if p_count is null or p_count < 1 or p_count > 6 then
    raise exception 'count must be between 1 and 6';
  end if;

  select id, status, scheduled_at, is_internal into v_match
    from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status not in ('confirmed', 'proposed') then
    raise exception 'Substitutes only for proposed/confirmed matches';
  end if;
  if v_match.scheduled_at <= now() then
    raise exception 'Match already started';
  end if;

  select t.id, t.city into v_team
    from public.match_sides ms
    join public.teams t on t.id = ms.team_id
    where ms.match_id = p_match_id
      and ms.side = p_side::side
      and public.is_team_leader(t.id, v_user);
  if not found then
    raise exception 'Only the captain or sub-captain of that side can post';
  end if;

  insert into public.open_substitute_requests(
    match_id, team_id, side, position_needed, count_needed, notes, city, created_by
  )
  values (
    p_match_id, v_team.id, p_side::side,
    nullif(p_position, ''),
    p_count,
    nullif(trim(p_notes), ''),
    v_team.city,
    v_user
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.post_substitute_request(uuid, text, text, int, text) from public, anon;
grant execute on function public.post_substitute_request(uuid, text, text, int, text) to authenticated;
