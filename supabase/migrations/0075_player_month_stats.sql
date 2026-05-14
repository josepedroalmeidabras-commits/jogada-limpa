-- =============================================================================
-- 0075 — Stats mensais do jogador (só competição)
-- =============================================================================
-- Para o card "Este mês" no home — antes mostrava stats da equipa (jogos/V/E/D
-- + golos marcados/sofridos pela equipa), agora mostra do JOGADOR: jogos,
-- vitórias/empates/derrotas, golos pessoais, assistências e MVPs.
--
-- Como em 0072/0074, exclui peladinhas.

create or replace function public.player_month_stats(
  p_user_id uuid,
  p_year    int,
  p_month   int,
  p_sport_id int default 2
) returns table (
  matches_played int,
  wins           int,
  draws          int,
  losses         int,
  goals          int,
  assists        int,
  mvps           int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  with month_matches as (
    select
      mp.match_id,
      mp.side,
      mp.goals,
      mp.assists,
      m.final_score_a,
      m.final_score_b
    from public.match_participants mp
    join public.matches m on m.id = mp.match_id
    where mp.user_id = p_user_id
      and mp.attendance in ('attended','substitute_in')
      and m.status = 'validated'
      and m.final_score_a is not null
      and m.final_score_b is not null
      and not coalesce(m.is_internal, false)
      and m.sport_id = p_sport_id
      and extract(year from m.scheduled_at)::int = p_year
      and extract(month from m.scheduled_at)::int = p_month
  ),
  mvp_per_match as (
    select v.match_id, v.mvp_user_id,
           rank() over (partition by v.match_id order by count(*) desc) as r
    from public.match_mvp_votes v
    join month_matches mm on mm.match_id = v.match_id
    group by v.match_id, v.mvp_user_id
  )
  select
    count(*)::int as matches_played,
    count(*) filter (
      where (mm.side = 'A'::side and mm.final_score_a > mm.final_score_b)
         or (mm.side = 'B'::side and mm.final_score_b > mm.final_score_a)
    )::int as wins,
    count(*) filter (where mm.final_score_a = mm.final_score_b)::int as draws,
    count(*) filter (
      where (mm.side = 'A'::side and mm.final_score_a < mm.final_score_b)
         or (mm.side = 'B'::side and mm.final_score_b < mm.final_score_a)
    )::int as losses,
    coalesce(sum(mm.goals), 0)::int as goals,
    coalesce(sum(mm.assists), 0)::int as assists,
    (
      select count(*)::int
      from mvp_per_match w
      where w.mvp_user_id = p_user_id and w.r = 1
    ) as mvps
  from month_matches mm;
end;
$$;

grant execute on function public.player_month_stats(uuid, int, int, int) to authenticated;
