-- =============================================================================
-- 0074 — Stats por ano (época)
-- =============================================================================
-- Cada época = um ano civil. Permite ao jogador ver o histórico anual:
-- 2026 (esta), 2025, 2024... como nas estatísticas de carreira em apps tipo
-- Flashscore.
--
-- Mantém regra de 0072: peladinhas continuam fora.

create or replace view public.player_year_stats as
select
  mp.user_id,
  m.sport_id,
  extract(year from m.scheduled_at)::int as year,
  count(*) filter (where mp.attendance in ('attended','substitute_in'))::int as matches_played,
  count(*) filter (
    where mp.attendance in ('attended','substitute_in')
      and ((mp.side = 'A'::side and m.final_score_a > m.final_score_b)
        or (mp.side = 'B'::side and m.final_score_b > m.final_score_a))
  )::int as wins,
  count(*) filter (
    where mp.attendance in ('attended','substitute_in')
      and m.final_score_a = m.final_score_b
  )::int as draws,
  count(*) filter (
    where mp.attendance in ('attended','substitute_in')
      and ((mp.side = 'A'::side and m.final_score_a < m.final_score_b)
        or (mp.side = 'B'::side and m.final_score_b < m.final_score_a))
  )::int as losses,
  coalesce(sum(mp.goals),   0)::int as goals,
  coalesce(sum(mp.assists), 0)::int as assists
from public.match_participants mp
join public.matches m on m.id = mp.match_id
where m.status = 'validated'
  and m.final_score_a is not null
  and m.final_score_b is not null
  and not coalesce(m.is_internal, false)
group by mp.user_id, m.sport_id, extract(year from m.scheduled_at);

grant select on public.player_year_stats to authenticated, anon;
