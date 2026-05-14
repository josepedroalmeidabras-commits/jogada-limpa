-- =============================================================================
-- 0079 — friends_recent_matches inclui golos e assistências do amigo
-- =============================================================================

drop function if exists public.friends_recent_matches(int);

create or replace function public.friends_recent_matches(p_limit int default 8)
returns table (
  match_id        uuid,
  scheduled_at    timestamptz,
  side_a_name     text,
  side_b_name     text,
  side_a_photo    text,
  side_b_photo    text,
  final_score_a   int,
  final_score_b   int,
  friend_id       uuid,
  friend_name     text,
  friend_photo    text,
  friend_side     text,
  friend_goals    int,
  friend_assists  int,
  is_internal     boolean
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
      select distinct
        mp.match_id as m_id,
        mp.user_id  as fid,
        mp.side,
        coalesce(mp.goals,   0) as goals,
        coalesce(mp.assists, 0) as assists
      from public.match_participants mp
      where mp.user_id in (select fid from my_friends)
        and mp.attendance in ('attended', 'substitute_in')
    ),
    one_per_match as (
      select
        fm.m_id,
        (array_agg(fm.fid order by fm.fid::text))[1]      as fid,
        (array_agg(fm.side::text order by fm.fid::text))[1] as side,
        (array_agg(fm.goals order by fm.fid::text))[1]    as goals,
        (array_agg(fm.assists order by fm.fid::text))[1]  as assists
      from friend_matches fm
      group by fm.m_id
    )
    select
      m.id,
      m.scheduled_at,
      case when coalesce(m.is_internal,false) and m.side_a_label is not null
           then m.side_a_label else ta.name end,
      case when coalesce(m.is_internal,false) and m.side_b_label is not null
           then m.side_b_label else tb.name end,
      ta.photo_url,
      tb.photo_url,
      m.final_score_a,
      m.final_score_b,
      opm.fid,
      pf.name,
      pf.photo_url,
      opm.side,
      opm.goals,
      opm.assists,
      coalesce(m.is_internal, false)
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
