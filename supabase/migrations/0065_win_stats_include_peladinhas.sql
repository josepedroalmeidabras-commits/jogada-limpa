-- =============================================================================
-- WIN STATS — peladinhas passam a contar para o global, com breakdown
-- =============================================================================
-- Revisão da decisão de 0052: o user quer ver TODAS as vitórias no win% global,
-- mas com duas vistas separadas no UI (peladinha vs competição).
--
-- Nova `user_win_stats` (substitui a antiga) traz três conjuntos de colunas:
--   wins / draws / losses / matches / win_pct        → TOTAL (incl. peladinhas)
--   comp_wins / .. / comp_win_pct                    → só jogos entre equipas
--   pel_wins / .. / pel_win_pct                      → só peladinhas internas
--
-- `team_win_stats` mantém-se a contar só competição: numa peladinha as duas
-- sides são a mesma equipa, logo win% peladinha de uma equipa daria sempre
-- ~50% e é irrelevante.

create or replace view public.user_win_stats as
with results as (
  select
    mp.user_id,
    m.sport_id,
    coalesce(m.is_internal, false) as is_pel,
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
)
select
  user_id,
  sport_id,

  -- TOTAL (incl. peladinhas)
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
  end as win_pct,

  -- COMPETIÇÃO (só inter-equipas)
  count(*) filter (where outcome = 'W' and not is_pel)::int as comp_wins,
  count(*) filter (where outcome = 'D' and not is_pel)::int as comp_draws,
  count(*) filter (where outcome = 'L' and not is_pel)::int as comp_losses,
  count(*) filter (where not is_pel)::int                   as comp_matches,
  case
    when count(*) filter (where not is_pel) = 0 then 0::numeric
    else round(
      (count(*) filter (where outcome = 'W' and not is_pel))::numeric * 100.0 /
        count(*) filter (where not is_pel),
      0
    )
  end as comp_win_pct,

  -- PELADINHA (só internas)
  count(*) filter (where outcome = 'W' and is_pel)::int as pel_wins,
  count(*) filter (where outcome = 'D' and is_pel)::int as pel_draws,
  count(*) filter (where outcome = 'L' and is_pel)::int as pel_losses,
  count(*) filter (where is_pel)::int                   as pel_matches,
  case
    when count(*) filter (where is_pel) = 0 then 0::numeric
    else round(
      (count(*) filter (where outcome = 'W' and is_pel))::numeric * 100.0 /
        count(*) filter (where is_pel),
      0
    )
  end as pel_win_pct

from results
group by user_id, sport_id;

grant select on public.user_win_stats to authenticated;
