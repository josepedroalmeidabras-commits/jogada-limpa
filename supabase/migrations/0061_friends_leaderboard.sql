-- =============================================================================
-- FRIENDS LEADERBOARD
-- =============================================================================
-- Lista os amigos (e o próprio) ordenados por % de vitórias num desporto.
-- Inclui apenas pessoas com >=1 jogo validado nesse desporto.

create or replace function public.friends_leaderboard(
  p_sport_id int default 2
)
returns table (
  user_id   uuid,
  name      text,
  photo_url text,
  win_pct   numeric,
  matches   int,
  is_self   boolean
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
    with my_friends as (
      select case
               when f.requester_id = v_user then f.addressee_id
               else f.requester_id
             end as fid
      from public.friendships f
      where f.status = 'accepted'
        and (f.requester_id = v_user or f.addressee_id = v_user)
    ),
    pool as (
      select v_user as uid
      union
      select fid from my_friends
    )
    select
      p.id                                                 as user_id,
      p.name                                               as name,
      p.photo_url                                          as photo_url,
      coalesce(uws.win_pct, 0)                             as win_pct,
      coalesce(uws.matches, 0)                             as matches,
      (p.id = v_user)                                      as is_self
    from pool po
    join public.profiles p on p.id = po.uid
    left join public.user_win_stats uws
      on uws.user_id = po.uid and uws.sport_id = p_sport_id
    where p.deleted_at is null
    order by coalesce(uws.win_pct, 0) desc,
             coalesce(uws.matches, 0) desc;
end;
$$;

revoke all on function public.friends_leaderboard(int) from public, anon;
grant execute on function public.friends_leaderboard(int) to authenticated;
