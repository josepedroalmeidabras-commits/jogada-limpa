-- =============================================================================
-- MVP OF THE WEEK (city)
-- =============================================================================
-- Devolve o jogador mais votado MVP nos últimos 7 dias entre jogos na cidade
-- do utilizador.

create or replace function public.mvp_of_week(p_city text)
returns table (
  user_id   uuid,
  name      text,
  photo_url text,
  votes     int
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
      select m.id
      from public.matches m
      join public.match_sides ms on ms.match_id = m.id
      join public.teams t on t.id = ms.team_id
      where m.status = 'validated'
        and m.validated_at > now() - interval '7 days'
        and t.city = p_city
    ),
    tally as (
      select v.mvp_user_id as uid, count(*)::int as votes
      from public.match_mvp_votes v
      where v.match_id in (select id from city_matches)
      group by v.mvp_user_id
    )
    select p.id, p.name, p.photo_url, t.votes
    from tally t
    join public.profiles p on p.id = t.uid
    where p.deleted_at is null
    order by t.votes desc
    limit 1;
end;
$$;

revoke all on function public.mvp_of_week(text) from public, anon;
grant execute on function public.mvp_of_week(text) to authenticated;
