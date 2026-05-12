-- =============================================================================
-- RATING HISTORY per match
-- =============================================================================
-- Para o gráfico de evolução de prestação. Para cada jogo validado em que o
-- user participou, devolve a média das reviews que recebeu (1-5).
--
-- Anonimato: para não revelar o rating individual quando há só 1 review,
-- pedimos count(*) >= 2 quando o caller não é o próprio user.

create or replace function public.fetch_user_rating_history(
  p_user_id uuid,
  p_limit   int default 12
)
returns table (
  match_id          uuid,
  scheduled_at      timestamptz,
  side_a_name       text,
  side_b_name       text,
  my_side           side,
  final_score_a     int,
  final_score_b     int,
  avg_rating        numeric,
  review_count      int
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
  v_min  int  := case when v_user = p_user_id then 1 else 2 end;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  return query
    with my_rows as (
      select mp.match_id, mp.side
      from public.match_participants mp
      where mp.user_id = p_user_id
        and mp.attendance in ('attended','substitute_in')
    ),
    rated as (
      select
        r.match_id,
        round((avg(r.fair_play) + avg(r.punctuality)
             + avg(r.technical_level) + avg(r.attitude)) / 4.0::numeric, 1) as avg_rating,
        count(*)::int as review_count
      from public.reviews r
      where r.reviewed_id = p_user_id
        and r.role in ('opponent','teammate')
      group by r.match_id
      having count(*) >= v_min
    )
    select
      m.id,
      m.scheduled_at,
      ta.name,
      tb.name,
      mr.side,
      m.final_score_a,
      m.final_score_b,
      rd.avg_rating,
      rd.review_count
    from my_rows mr
    join rated rd on rd.match_id = mr.match_id
    join public.matches m on m.id = mr.match_id
    join public.match_sides msa on msa.match_id = m.id and msa.side = 'A'
    join public.match_sides msb on msb.match_id = m.id and msb.side = 'B'
    join public.teams ta on ta.id = msa.team_id
    join public.teams tb on tb.id = msb.team_id
    where m.status = 'validated'
    order by m.scheduled_at desc
    limit p_limit;
end;
$$;

revoke all on function public.fetch_user_rating_history(uuid, int) from public, anon;
grant execute on function public.fetch_user_rating_history(uuid, int) to authenticated;
