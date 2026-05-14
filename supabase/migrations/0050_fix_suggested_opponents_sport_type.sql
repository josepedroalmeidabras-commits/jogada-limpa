-- =============================================================================
-- FIX: suggested_opponents — v_sport declarado uuid, devia ser int
-- =============================================================================
-- A 0045 declarou `v_sport uuid` mas `teams.sport_id` é `int` (refs sports.id
-- que é integer). O SELECT INTO tentava converter "2" para uuid e rebentava
-- com "invalid input syntax for type uuid: 2".

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
  v_user   uuid := auth.uid();
  v_sport  int;
  v_city   text;
  v_my_elo numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select t.sport_id, t.city
    into v_sport, v_city
  from public.teams t
  where t.id = p_my_team_id and t.is_active;
  if not found then raise exception 'Team not found'; end if;

  select te.elo_avg
    into v_my_elo
  from public.team_elo te
  where te.team_id = p_my_team_id;
  v_my_elo := coalesce(v_my_elo, 1200);

  return query
    with my_matches as (
      select ms.match_id as m_id
      from public.match_sides ms
      where ms.team_id = p_my_team_id
    ),
    head_count as (
      select ms.team_id as opp_id, count(*)::int as cnt
      from public.match_sides ms
      where ms.match_id in (select m_id from my_matches)
        and ms.team_id <> p_my_team_id
      group by ms.team_id
    ),
    candidates as (
      select
        t.id                                       as opp_id,
        t.name                                     as opp_name,
        t.photo_url                                as opp_photo,
        coalesce(te.elo_avg, 1200)::numeric        as opp_elo,
        coalesce(te.member_count, 0)::int          as opp_members
      from public.teams t
      left join public.team_elo te on te.team_id = t.id
      where t.is_active
        and t.id <> p_my_team_id
        and t.sport_id = v_sport
        and t.city = v_city
    )
    select
      c.opp_id,
      c.opp_name,
      c.opp_photo,
      c.opp_elo,
      c.opp_members,
      abs(c.opp_elo - v_my_elo)::numeric,
      coalesce(hc.cnt, 0)::int
    from candidates c
    left join head_count hc on hc.opp_id = c.opp_id
    order by abs(c.opp_elo - v_my_elo) asc, c.opp_elo desc
    limit p_limit;
end;
$$;

revoke all on function public.suggested_opponents(uuid, int) from public, anon;
grant execute on function public.suggested_opponents(uuid, int) to authenticated;
