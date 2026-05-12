-- =============================================================================
-- GOALS + ASSISTS per player per match
-- =============================================================================
-- Captains record goal/assist counts during result submission. Aggregates flow
-- to a season-stats view that surfaces on profile.

alter table public.match_participants
  add column if not exists goals   smallint default 0 check (goals   >= 0),
  add column if not exists assists smallint default 0 check (assists >= 0);


-- Redefine the RPC: drop the old signature, replace with a single JSONB-based
-- one. Client passes [{user_id, attended, goals, assists}, ...] for *this
-- captain's side only*.
drop function if exists public.submit_match_side_result(uuid, int, int, uuid[]);

create or replace function public.submit_match_side_result(
  p_match_id     uuid,
  p_score_a      int,
  p_score_b      int,
  p_participants jsonb  -- array of {user_id, attended, goals, assists}
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_status      match_status;
  v_side        side;
  v_row         jsonb;
  v_uid         uuid;
  v_attended    boolean;
  v_goals       int;
  v_assists     int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
    raise exception 'Scores must be non-negative integers';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;

  if v_status not in ('confirmed', 'result_pending', 'disputed') then
    raise exception 'Match is not ready for results';
  end if;

  select side into v_side from public.match_sides
    where match_id = p_match_id and captain_id = v_user;
  if not found then
    raise exception 'Only captains can submit results';
  end if;

  -- Reset all this side's participants to 'missed' baseline first
  update public.match_participants
    set attendance   = 'missed'::attendance,
        goals        = 0,
        assists      = 0,
        responded_at = now()
    where match_id = p_match_id and side = v_side;

  -- Then apply the captain's data row by row
  if p_participants is not null then
    for v_row in select * from jsonb_array_elements(p_participants) loop
      v_uid      := (v_row->>'user_id')::uuid;
      v_attended := coalesce((v_row->>'attended')::boolean, true);
      v_goals    := coalesce((v_row->>'goals')::int, 0);
      v_assists  := coalesce((v_row->>'assists')::int, 0);

      if v_goals < 0 then v_goals := 0; end if;
      if v_assists < 0 then v_assists := 0; end if;

      update public.match_participants
        set attendance = case when v_attended then 'attended'::attendance else 'missed'::attendance end,
            goals      = v_goals,
            assists    = v_assists,
            responded_at = now()
        where match_id = p_match_id and side = v_side and user_id = v_uid;
    end loop;
  end if;

  -- upsert score submission for this side
  insert into public.match_score_submissions(
    match_id, submitted_by_side, score_a, score_b, submitted_by
  )
  values (p_match_id, v_side, p_score_a, p_score_b, v_user)
  on conflict (match_id, submitted_by_side) do update
    set score_a = excluded.score_a,
        score_b = excluded.score_b,
        submitted_by = excluded.submitted_by,
        submitted_at = now();

  -- mark match as result_pending if currently confirmed
  update public.matches
    set status = 'result_pending'
    where id = p_match_id and status = 'confirmed';
end;
$$;

revoke all on function public.submit_match_side_result(uuid, int, int, jsonb)
  from public, anon;
grant execute on function public.submit_match_side_result(uuid, int, int, jsonb)
  to authenticated;


-- =============================================================================
-- player_season_stats view — convenience for profile screens.
-- Sums goals/assists, counts attended matches, per (user, sport).
-- =============================================================================
create or replace view public.player_season_stats as
select
  mp.user_id,
  m.sport_id,
  count(*) filter (where mp.attendance in ('attended','substitute_in'))::int as matches_played,
  coalesce(sum(mp.goals),   0)::int as goals,
  coalesce(sum(mp.assists), 0)::int as assists
from public.match_participants mp
join public.matches m on m.id = mp.match_id
where m.status = 'validated'
group by mp.user_id, m.sport_id;

grant select on public.player_season_stats to authenticated, anon;


-- =============================================================================
-- top_scorers RPC — for a future ranking screen
-- =============================================================================
create or replace function public.top_scorers(
  p_sport_id int default 2,
  p_city     text default null,
  p_limit    int default 20
)
returns table (
  user_id        uuid,
  name           text,
  photo_url      text,
  city           text,
  goals          int,
  assists        int,
  matches_played int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select
      pss.user_id,
      p.name,
      p.photo_url,
      p.city,
      pss.goals,
      pss.assists,
      pss.matches_played
    from public.player_season_stats pss
    join public.profiles p on p.id = pss.user_id
    where pss.sport_id = p_sport_id
      and pss.goals > 0
      and p.deleted_at is null
      and (p_city is null or p.city = p_city)
    order by pss.goals desc, pss.assists desc, pss.matches_played asc
    limit p_limit;
end;
$$;

revoke all on function public.top_scorers(int, text, int) from public, anon;
grant execute on function public.top_scorers(int, text, int) to authenticated;
