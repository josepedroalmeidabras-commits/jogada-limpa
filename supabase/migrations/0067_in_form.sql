-- =============================================================================
-- 0067 — IN FORM (FIFA TOTW style)
-- =============================================================================
-- Vista que devolve users actualmente "in form" com base na última semana:
--   * 3+ G+A em jogos validados nos últimos 7 dias  → reason='scorer'
--   * 2+ MVPs em jogos validados nos últimos 7 dias → reason='mvp'
--   * Ambas → reason='both' (max premium)
-- Recomputa live — não precisa de cron job. UI consome para mostrar tier
-- especial no PlayerFUTCard.

create or replace view public.user_in_form as
with last_week_matches as (
  select id
  from public.matches
  where status = 'validated'
    and validated_at >= now() - interval '7 days'
),
ga as (
  select mp.user_id,
         sum(coalesce(mp.goals,0) + coalesce(mp.assists,0))::int as ga_count,
         sum(coalesce(mp.goals,0))::int                          as goals,
         sum(coalesce(mp.assists,0))::int                        as assists
  from public.match_participants mp
  join last_week_matches m on m.id = mp.match_id
  where mp.attendance in ('attended','substitute_in')
  group by mp.user_id
),
mvp_per_match as (
  select v.match_id, v.mvp_user_id,
         count(*) as votes,
         rank() over (partition by v.match_id order by count(*) desc) as r
  from public.match_mvp_votes v
  join last_week_matches m on m.id = v.match_id
  group by v.match_id, v.mvp_user_id
),
mvp_counts as (
  select mvp_user_id as user_id, count(*)::int as mvp_count
  from mvp_per_match
  where r = 1
  group by mvp_user_id
)
select
  coalesce(ga.user_id, mvp.user_id)        as user_id,
  coalesce(ga.ga_count, 0)                 as ga_count,
  coalesce(ga.goals, 0)                    as goals,
  coalesce(ga.assists, 0)                  as assists,
  coalesce(mvp.mvp_count, 0)               as mvp_count,
  case
    when coalesce(mvp.mvp_count,0) >= 2 and coalesce(ga.ga_count,0) >= 3 then 'both'
    when coalesce(mvp.mvp_count,0) >= 2 then 'mvp'
    when coalesce(ga.ga_count,0) >= 3 then 'scorer'
    else null
  end as reason
from ga
full outer join mvp_counts mvp on mvp.user_id = ga.user_id
where coalesce(mvp.mvp_count,0) >= 2 or coalesce(ga.ga_count,0) >= 3;

grant select on public.user_in_form to authenticated;
