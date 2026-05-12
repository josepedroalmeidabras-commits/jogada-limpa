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
