-- =============================================================================
-- FRIENDS RECENT ACTIVITY + MUTUAL FRIENDS
-- =============================================================================
-- Two helpers that make the friends system feel alive: a recent-matches feed
-- where at least one participant is a friend, and a mutual-friends count when
-- looking at another user's profile.

-- ============================ friends_recent_matches =======================
create or replace function public.friends_recent_matches(p_limit int default 8)
returns table (
  match_id      uuid,
  scheduled_at  timestamptz,
  side_a_name   text,
  side_b_name   text,
  final_score_a int,
  final_score_b int,
  friend_id     uuid,
  friend_name   text,
  friend_photo  text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  return query
    with my_friends as (
      select case
               when f.requester_id = v_user then f.addressee_id
               else f.requester_id
             end as friend_id
      from public.friendships f
      where f.status = 'accepted'
        and (f.requester_id = v_user or f.addressee_id = v_user)
    ),
    friend_matches as (
      select distinct mp.match_id, mp.user_id as friend_id
      from public.match_participants mp
      where mp.user_id in (select friend_id from my_friends)
        and mp.attendance in ('attended', 'substitute_in')
    ),
    -- pick the first friend per match for the avatar/label
    one_per_match as (
      select fm.match_id, min(fm.friend_id::text)::uuid as friend_id
      from friend_matches fm
      group by fm.match_id
    )
    select
      m.id,
      m.scheduled_at,
      ta.name,
      tb.name,
      m.final_score_a,
      m.final_score_b,
      opm.friend_id,
      pf.name,
      pf.photo_url
    from one_per_match opm
    join public.matches m on m.id = opm.match_id
    join public.match_sides msa on msa.match_id = m.id and msa.side = 'A'
    join public.match_sides msb on msb.match_id = m.id and msb.side = 'B'
    join public.teams ta on ta.id = msa.team_id
    join public.teams tb on tb.id = msb.team_id
    join public.profiles pf on pf.id = opm.friend_id
    where m.status = 'validated'
      and m.final_score_a is not null
      and m.final_score_b is not null
    order by m.scheduled_at desc
    limit p_limit;
end;
$$;

revoke all on function public.friends_recent_matches(int) from public, anon;
grant execute on function public.friends_recent_matches(int) to authenticated;


-- ============================ mutual_friends ===============================
create or replace function public.mutual_friends(
  p_other_id uuid,
  p_limit    int default 5
)
returns table (
  id        uuid,
  name      text,
  photo_url text,
  total     int
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  return query
    with my_friends as (
      select case
               when f.requester_id = v_user then f.addressee_id
               else f.requester_id
             end as friend_id
      from public.friendships f
      where f.status = 'accepted'
        and (f.requester_id = v_user or f.addressee_id = v_user)
    ),
    their_friends as (
      select case
               when f.requester_id = p_other_id then f.addressee_id
               else f.requester_id
             end as friend_id
      from public.friendships f
      where f.status = 'accepted'
        and (f.requester_id = p_other_id or f.addressee_id = p_other_id)
    ),
    mutual as (
      select friend_id from my_friends
      intersect
      select friend_id from their_friends
    ),
    total_count as (
      select count(*)::int as total from mutual
    )
    select p.id, p.name, p.photo_url, (select total from total_count) as total
    from mutual m
    join public.profiles p on p.id = m.friend_id
    where p.deleted_at is null
    order by p.name
    limit p_limit;
end;
$$;

revoke all on function public.mutual_friends(uuid, int) from public, anon;
grant execute on function public.mutual_friends(uuid, int) to authenticated;
