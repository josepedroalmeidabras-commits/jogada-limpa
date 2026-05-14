-- =============================================================================
-- 0072 — peladinhas fora dos rankings (golos, MVPs, top players)
-- =============================================================================
-- Regra: peladinhas contam APENAS para o win% global do perfil. Tudo o resto
-- (rankings de goleadores, MVPs, top players, season stats no perfil) é
-- só competição (amigáveis).
--
-- Mudanças:
--  * `player_season_stats` view → filtra `is_internal = false`
--  * `mvp_totals` view → filtra `is_internal = false`
--  * `top_players` no UI passa a usar `comp_win_pct` / `comp_matches`
--    (já expostos em `user_win_stats` desde 0065 — app-side change)

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
  and not coalesce(m.is_internal, false)
group by mp.user_id, m.sport_id;

grant select on public.player_season_stats to authenticated, anon;

create or replace view public.mvp_totals as
select
  v.mvp_user_id as user_id,
  count(*)::int as mvp_votes
from public.match_mvp_votes v
join public.matches m on m.id = v.match_id
where not coalesce(m.is_internal, false)
group by v.mvp_user_id;

grant select on public.mvp_totals to authenticated;
