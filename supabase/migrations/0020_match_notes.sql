-- =============================================================================
-- MATCH NOTES (kit colour, what to bring, etc.)
-- =============================================================================
-- Optional free-text note set by either captain. Distinct from `message`
-- (which is the proposal pitch). Visible to both teams once the match exists.

alter table public.matches
  add column if not exists notes text;

-- Drop the older 6-arg propose_match overload before redefining with 7 args.
drop function if exists public.propose_match(uuid, uuid, timestamptz, text, boolean, text);

-- Update RPC: allow proposing captain to set initial notes.
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
  if v_proposer is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_proposing_team
    from public.teams
   where id = p_proposing_team_id and is_active;
  if not found then
    raise exception 'Proposing team not found';
  end if;

  if v_proposing_team.captain_id <> v_proposer then
    raise exception 'Only the team captain can propose';
  end if;

  select * into v_opponent_team
    from public.teams
   where id = p_opponent_team_id and is_active;
  if not found then
    raise exception 'Opponent team not found';
  end if;

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


-- Captains of either team can update notes on a non-validated match.
create or replace function public.update_match_notes(
  p_match_id uuid,
  p_notes    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_involved boolean;
  v_status   match_status;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;
  if v_status in ('validated', 'cancelled') then
    raise exception 'Match notes are locked';
  end if;

  select exists(
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) into v_involved;
  if not v_involved then
    raise exception 'Only the involved captains can update notes';
  end if;

  update public.matches
    set notes = nullif(trim(p_notes), '')
    where id = p_match_id;
end;
$$;

revoke all on function public.update_match_notes(uuid, text) from public, anon;
grant execute on function public.update_match_notes(uuid, text) to authenticated;
