-- =============================================================================
-- CITY PULSE — pequeno indicador de actividade local
-- =============================================================================
-- Conta jogos validados nos últimos 7 dias, equipas ativas e jogadores únicos
-- numa cidade. Usado num chip subtil no home.

create or replace function public.city_pulse(p_city text)
returns table (
  matches_7d   int,
  active_teams int,
  active_players int
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_city is null or trim(p_city) = '' then
    return;
  end if;

  return query
    with city_matches as (
      select distinct m.id
      from public.matches m
      join public.match_sides ms on ms.match_id = m.id
      join public.teams t on t.id = ms.team_id
      where m.status = 'validated'
        and m.validated_at > now() - interval '7 days'
        and t.city = p_city
        and not coalesce(m.is_internal, false)
    ),
    teams_count as (
      select count(*)::int as cnt
      from public.teams
      where city = p_city and is_active
    ),
    players_count as (
      select count(distinct p.id)::int as cnt
      from public.profiles p
      where p.city = p_city and p.deleted_at is null
    )
    select
      (select count(*) from city_matches)::int,
      (select cnt from teams_count),
      (select cnt from players_count);
end;
$$;

revoke all on function public.city_pulse(text) from public, anon;
grant execute on function public.city_pulse(text) to authenticated;
