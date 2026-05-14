-- =============================================================================
-- PENDING STAT VOTES (nudge para home)
-- =============================================================================
-- Lista colegas de equipa (de qualquer das minhas equipas) para os quais ainda
-- não votei em nenhuma categoria. Limita a 6 para o nudge no home.

create or replace function public.pending_stat_vote_teammates(
  p_limit int default 6
)
returns table (
  user_id   uuid,
  name      text,
  photo_url text
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

  return query
    with my_teams as (
      select team_id from public.team_members where user_id = v_user
    ),
    teammates as (
      select distinct tm.user_id
      from public.team_members tm
      where tm.team_id in (select team_id from my_teams)
        and tm.user_id <> v_user
    )
    select p.id, p.name, p.photo_url
    from teammates t
    join public.profiles p on p.id = t.user_id
    where p.deleted_at is null
      and not exists (
        select 1 from public.player_stat_votes psv
        where psv.voter_id = v_user and psv.target_id = t.user_id
      )
    order by p.name
    limit p_limit;
end;
$$;

revoke all on function public.pending_stat_vote_teammates(int) from public, anon;
grant execute on function public.pending_stat_vote_teammates(int) to authenticated;
