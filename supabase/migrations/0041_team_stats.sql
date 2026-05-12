-- =============================================================================
-- TEAM CONTRIBUTORS — top goleador + top assistente por equipa
-- =============================================================================
-- Agrega golos e assistências dos membros nos jogos validados onde foram do
-- lado da equipa.

create or replace function public.fetch_team_top_contributors(
  p_team_id uuid,
  p_limit   int default 10
)
returns table (
  user_id      uuid,
  name         text,
  photo_url    text,
  goals        int,
  assists      int,
  matches      int,
  goal_share   numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_total_goals int;
begin
  select coalesce(sum(case
                   when ms.team_id = p_team_id and ms.side = 'A' then m.final_score_a
                   when ms.team_id = p_team_id and ms.side = 'B' then m.final_score_b
                   else 0 end), 0)
    into v_total_goals
    from public.matches m
    join public.match_sides ms on ms.match_id = m.id
    where ms.team_id = p_team_id
      and m.status = 'validated'
      and m.is_internal = false;

  return query
    select mp.user_id,
           p.name,
           p.photo_url,
           coalesce(sum(mp.goals), 0)::int   as goals,
           coalesce(sum(mp.assists), 0)::int as assists,
           count(*)::int                     as matches,
           case when v_total_goals = 0 then 0
                else round(100.0 * coalesce(sum(mp.goals), 0) / v_total_goals, 0)
           end as goal_share
    from public.match_participants mp
    join public.matches m   on m.id = mp.match_id
    join public.match_sides ms on ms.match_id = m.id
                              and ms.side = mp.side
                              and ms.team_id = p_team_id
    join public.profiles p on p.id = mp.user_id
    where m.status = 'validated'
      and m.is_internal = false
      and mp.attendance in ('attended','substitute_in')
    group by mp.user_id, p.name, p.photo_url
    having coalesce(sum(mp.goals), 0) > 0
        or coalesce(sum(mp.assists), 0) > 0
        or count(*) > 0
    order by goals desc, assists desc, matches desc
    limit p_limit;
end;
$$;

revoke all on function public.fetch_team_top_contributors(uuid, int) from public, anon;
grant execute on function public.fetch_team_top_contributors(uuid, int) to authenticated;
