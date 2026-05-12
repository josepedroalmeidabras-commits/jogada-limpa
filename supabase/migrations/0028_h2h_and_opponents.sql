-- =============================================================================
-- HEAD-TO-HEAD + SUGGESTED OPPONENTS
-- =============================================================================
-- Helpers so captains can size up an opponent before agreeing to a match, and
-- discover similar-level teams in their city to challenge.

-- ============================ team_head_to_head ============================
-- Returns aggregated record between two teams across validated matches.
create or replace function public.team_head_to_head(
  p_team_a uuid,
  p_team_b uuid
)
returns table (
  played      int,
  a_wins      int,
  b_wins      int,
  draws       int,
  a_goals     int,
  b_goals     int,
  last_played timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    with matched as (
      select m.id, m.scheduled_at, m.final_score_a, m.final_score_b,
             max(case when ms.side = 'A' then ms.team_id end) as side_a_team,
             max(case when ms.side = 'B' then ms.team_id end) as side_b_team
      from public.matches m
      join public.match_sides ms on ms.match_id = m.id
      where m.status = 'validated'
        and m.final_score_a is not null
        and m.final_score_b is not null
      group by m.id, m.scheduled_at, m.final_score_a, m.final_score_b
      having
        (max(case when ms.side = 'A' then ms.team_id end) = p_team_a
         and max(case when ms.side = 'B' then ms.team_id end) = p_team_b)
        or
        (max(case when ms.side = 'A' then ms.team_id end) = p_team_b
         and max(case when ms.side = 'B' then ms.team_id end) = p_team_a)
    ),
    normalised as (
      select
        scheduled_at,
        case when side_a_team = p_team_a then final_score_a else final_score_b end as a_score,
        case when side_a_team = p_team_a then final_score_b else final_score_a end as b_score
      from matched
    )
    select
      count(*)::int as played,
      sum(case when a_score > b_score then 1 else 0 end)::int as a_wins,
      sum(case when a_score < b_score then 1 else 0 end)::int as b_wins,
      sum(case when a_score = b_score then 1 else 0 end)::int as draws,
      coalesce(sum(a_score), 0)::int as a_goals,
      coalesce(sum(b_score), 0)::int as b_goals,
      max(scheduled_at) as last_played
    from normalised;
end;
$$;

revoke all on function public.team_head_to_head(uuid, uuid) from public, anon;
grant execute on function public.team_head_to_head(uuid, uuid) to authenticated;


-- ============================ suggested_opponents ==========================
-- Same sport + same city + active + not me, ordered by ELO closeness, with
-- "matches_against_me" count so the UI can hint at familiarity.
create or replace function public.suggested_opponents(
  p_my_team_id uuid,
  p_limit      int default 5
)
returns table (
  team_id      uuid,
  name         text,
  photo_url    text,
  elo_avg      numeric,
  member_count int,
  elo_diff     numeric,
  played_us    int
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
  v_me   record;
  v_my_elo numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_me from public.teams where id = p_my_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;

  select elo_avg into v_my_elo from public.team_elo where team_id = p_my_team_id;
  v_my_elo := coalesce(v_my_elo, 1200);

  return query
    with my_matches as (
      select match_id
      from public.match_sides
      where team_id = p_my_team_id
    ),
    head_count as (
      select ms.team_id as opp, count(*)::int as cnt
      from public.match_sides ms
      where ms.match_id in (select match_id from my_matches)
        and ms.team_id <> p_my_team_id
      group by ms.team_id
    ),
    candidates as (
      select t.id as team_id, t.name, t.photo_url,
             coalesce(te.elo_avg, 1200) as elo_avg,
             coalesce(te.member_count, 0) as member_count
      from public.teams t
      left join public.team_elo te on te.team_id = t.id
      where t.is_active
        and t.id <> p_my_team_id
        and t.sport_id = v_me.sport_id
        and t.city = v_me.city
    )
    select c.team_id, c.name, c.photo_url, c.elo_avg, c.member_count,
           abs(c.elo_avg - v_my_elo) as elo_diff,
           coalesce(hc.cnt, 0) as played_us
    from candidates c
    left join head_count hc on hc.opp = c.team_id
    order by elo_diff asc, c.elo_avg desc
    limit p_limit;
end;
$$;

revoke all on function public.suggested_opponents(uuid, int) from public, anon;
grant execute on function public.suggested_opponents(uuid, int) to authenticated;
