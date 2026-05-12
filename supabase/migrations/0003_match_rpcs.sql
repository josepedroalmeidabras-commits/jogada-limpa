-- =============================================================================
-- RPCs para propor + aceitar jogos (atomic, bypass RLS via SECURITY DEFINER)
-- =============================================================================

-- ============================ propose_match ===============================
create or replace function public.propose_match(
  p_proposing_team_id uuid,
  p_opponent_team_id  uuid,
  p_scheduled_at      timestamptz,
  p_location_name     text default null,
  p_location_tbd      boolean default false,
  p_message           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposer         uuid := auth.uid();
  v_match_id         uuid;
  v_proposing_team   public.teams%rowtype;
  v_opponent_team    public.teams%rowtype;
begin
  if v_proposer is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_proposing_team
    from public.teams
    where id = p_proposing_team_id and is_active;
  if not found then
    raise exception 'Proposing team not found or inactive';
  end if;

  if v_proposing_team.captain_id <> v_proposer then
    raise exception 'Only the captain can propose matches';
  end if;

  if p_proposing_team_id = p_opponent_team_id then
    raise exception 'Cannot challenge own team';
  end if;

  select * into v_opponent_team
    from public.teams
    where id = p_opponent_team_id and is_active;
  if not found then
    raise exception 'Opponent team not found or inactive';
  end if;

  if v_proposing_team.sport_id <> v_opponent_team.sport_id then
    raise exception 'Teams play different sports';
  end if;

  if p_scheduled_at <= now() then
    raise exception 'Match must be scheduled in the future';
  end if;

  insert into public.matches(
    sport_id, scheduled_at, location_name, location_tbd,
    status, proposed_by, message
  )
  values (
    v_proposing_team.sport_id, p_scheduled_at, p_location_name, coalesce(p_location_tbd, false),
    'proposed', v_proposer, p_message
  )
  returning id into v_match_id;

  insert into public.match_sides(match_id, side, team_id, captain_id) values
    (v_match_id, 'A', p_proposing_team_id, v_proposing_team.captain_id),
    (v_match_id, 'B', p_opponent_team_id,  v_opponent_team.captain_id);

  return v_match_id;
end;
$$;

revoke all on function public.propose_match(uuid, uuid, timestamptz, text, boolean, text)
  from public, anon;
grant execute on function public.propose_match(uuid, uuid, timestamptz, text, boolean, text)
  to authenticated;

-- ============================ accept_match ===============================
create or replace function public.accept_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user           uuid := auth.uid();
  v_status         match_status;
  v_is_captain_b   boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;

  if v_status <> 'proposed' then
    raise exception 'Match is not pending acceptance';
  end if;

  select exists(
    select 1 from public.match_sides
    where match_id = p_match_id and side = 'B' and captain_id = v_user
  ) into v_is_captain_b;

  if not v_is_captain_b then
    raise exception 'Only the opposing captain can accept';
  end if;

  update public.matches set status = 'confirmed' where id = p_match_id;
end;
$$;

revoke all on function public.accept_match(uuid) from public, anon;
grant execute on function public.accept_match(uuid) to authenticated;

-- ============================ reject_match (cancel proposal) ==============
create or replace function public.reject_match(p_match_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_status      match_status;
  v_involved    boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;

  if v_status <> 'proposed' then
    raise exception 'Only proposed matches can be rejected';
  end if;

  select exists(
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) into v_involved;

  if not v_involved then
    raise exception 'Only the involved captains can cancel';
  end if;

  update public.matches
    set status = 'cancelled',
        cancelled_reason = p_reason
    where id = p_match_id;
end;
$$;

revoke all on function public.reject_match(uuid, text) from public, anon;
grant execute on function public.reject_match(uuid, text) to authenticated;
