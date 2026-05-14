-- =============================================================================
-- TEAM STAT AGGREGATES
-- =============================================================================
-- Vista que devolve, por equipa, a média dos atributos dos seus membros para
-- cada categoria PES. Alimenta o TeamFUTCard.

create or replace view public.team_stats_aggregate as
select
  tm.team_id,
  psa.category,
  round(avg(psa.value))::int as value,
  count(distinct tm.user_id)::int as members_with_votes
from public.team_members tm
join public.player_stats_aggregate psa on psa.user_id = tm.user_id
group by tm.team_id, psa.category;

grant select on public.team_stats_aggregate to authenticated, anon;


-- ------ team_form: últimos 5 resultados (W/L/D) da equipa ----------
create or replace function public.team_recent_form(
  p_team_id uuid,
  p_limit   int default 5
)
returns table (outcome text, scheduled_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when ms.side = 'A' and m.final_score_a >  m.final_score_b then 'win'
      when ms.side = 'B' and m.final_score_b >  m.final_score_a then 'win'
      when m.final_score_a = m.final_score_b                    then 'draw'
      else                                                           'loss'
    end as outcome,
    m.scheduled_at
  from public.match_sides ms
  join public.matches m on m.id = ms.match_id
  where ms.team_id = p_team_id
    and m.status = 'validated'
    and m.final_score_a is not null
    and m.final_score_b is not null
    and not coalesce(m.is_internal, false)
  order by m.scheduled_at desc
  limit p_limit;
$$;

revoke all on function public.team_recent_form(uuid, int) from public, anon;
grant execute on function public.team_recent_form(uuid, int) to authenticated, anon;
