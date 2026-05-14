-- =============================================================================
-- WIN STATS — substitui ELO no UI por % de vitórias
-- =============================================================================
-- Vistas agregadas por jogador e por equipa com wins/draws/losses/total e
-- win_pct (0-100). Peladinhas internas (is_internal) excluídas — winning numa
-- random é luck, não competitividade.
--
-- A infra de ELO (user_sports.elo, team_elo, elo_history, tg_match_validated)
-- continua a existir por baixo para matchmaking, mas o UI passa a mostrar
-- win_pct.

create or replace view public.user_win_stats as
with results as (
  select
    mp.user_id,
    m.sport_id,
    case
      when mp.side = 'A'::side and m.final_score_a >  m.final_score_b then 'W'
      when mp.side = 'B'::side and m.final_score_b >  m.final_score_a then 'W'
      when m.final_score_a = m.final_score_b                          then 'D'
      else                                                                 'L'
    end as outcome
  from public.match_participants mp
  join public.matches m on m.id = mp.match_id
  where m.status = 'validated'
    and m.final_score_a is not null
    and m.final_score_b is not null
    and mp.attendance in ('attended', 'substitute_in')
    and not coalesce(m.is_internal, false)
)
select
  user_id,
  sport_id,
  count(*) filter (where outcome = 'W')::int as wins,
  count(*) filter (where outcome = 'D')::int as draws,
  count(*) filter (where outcome = 'L')::int as losses,
  count(*)::int                              as matches,
  case
    when count(*) = 0 then 0::numeric
    else round(
      (count(*) filter (where outcome = 'W'))::numeric * 100.0 / count(*),
      0
    )
  end as win_pct
from results
group by user_id, sport_id;

grant select on public.user_win_stats to authenticated;


create or replace view public.team_win_stats as
with results as (
  select
    ms.team_id,
    m.sport_id,
    case
      when ms.side = 'A'::side and m.final_score_a >  m.final_score_b then 'W'
      when ms.side = 'B'::side and m.final_score_b >  m.final_score_a then 'W'
      when m.final_score_a = m.final_score_b                          then 'D'
      else                                                                 'L'
    end as outcome
  from public.match_sides ms
  join public.matches m on m.id = ms.match_id
  where m.status = 'validated'
    and m.final_score_a is not null
    and m.final_score_b is not null
    and not coalesce(m.is_internal, false)
)
select
  team_id,
  sport_id,
  count(*) filter (where outcome = 'W')::int as wins,
  count(*) filter (where outcome = 'D')::int as draws,
  count(*) filter (where outcome = 'L')::int as losses,
  count(*)::int                              as matches,
  case
    when count(*) = 0 then 0::numeric
    else round(
      (count(*) filter (where outcome = 'W'))::numeric * 100.0 / count(*),
      0
    )
  end as win_pct
from results
group by team_id, sport_id;

grant select on public.team_win_stats to authenticated;
