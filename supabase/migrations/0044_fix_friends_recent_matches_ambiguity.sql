-- =============================================================================
-- FIX: friends_recent_matches ambiguous column "friend_id"
-- =============================================================================
-- The RETURNS TABLE declares friend_id as an OUT parameter, which PL/pgSQL
-- treats as a variable. The inner CTEs also alias columns to friend_id, so
-- references like `select friend_id from my_friends` become ambiguous.
-- Fix: rename inner CTE columns so they never collide with output params.

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
             end as fid
      from public.friendships f
      where f.status = 'accepted'
        and (f.requester_id = v_user or f.addressee_id = v_user)
    ),
    friend_matches as (
      select distinct mp.match_id as m_id, mp.user_id as fid
      from public.match_participants mp
      where mp.user_id in (select fid from my_friends)
        and mp.attendance in ('attended', 'substitute_in')
    ),
    one_per_match as (
      select fm.m_id, min(fm.fid::text)::uuid as fid
      from friend_matches fm
      group by fm.m_id
    )
    select
      m.id,
      m.scheduled_at,
      ta.name,
      tb.name,
      m.final_score_a,
      m.final_score_b,
      opm.fid,
      pf.name,
      pf.photo_url
    from one_per_match opm
    join public.matches m on m.id = opm.m_id
    join public.match_sides msa on msa.match_id = m.id and msa.side = 'A'
    join public.match_sides msb on msb.match_id = m.id and msb.side = 'B'
    join public.teams ta on ta.id = msa.team_id
    join public.teams tb on tb.id = msb.team_id
    join public.profiles pf on pf.id = opm.fid
    where m.status = 'validated'
      and m.final_score_a is not null
      and m.final_score_b is not null
    order by m.scheduled_at desc
    limit p_limit;
end;
$$;

revoke all on function public.friends_recent_matches(int) from public, anon;
grant execute on function public.friends_recent_matches(int) to authenticated;
