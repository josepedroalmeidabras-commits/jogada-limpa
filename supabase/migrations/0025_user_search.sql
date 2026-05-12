-- =============================================================================
-- USER SEARCH + FRIEND SUGGESTIONS
-- =============================================================================
-- Lightweight server-side helpers so the client doesn't have to fetch + filter
-- the entire profiles table.

-- ============================ search_profiles ==============================
-- Match name or city via ILIKE. Excludes self, soft-deleted, and users with a
-- block in either direction. Returns up to p_limit (default 30).
create or replace function public.search_profiles(
  p_query text,
  p_limit int default 30
)
returns table (
  id         uuid,
  name       text,
  photo_url  text,
  city       text,
  bio        text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
  v_q    text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  v_q := trim(coalesce(p_query, ''));
  if char_length(v_q) < 2 then
    return;
  end if;
  v_q := '%' || v_q || '%';

  return query
    select p.id, p.name, p.photo_url, p.city, p.bio
    from public.profiles p
    where p.deleted_at is null
      and p.id <> v_user
      and (p.name ilike v_q or p.city ilike v_q)
      and not exists (
        select 1 from public.blocked_users b
        where (b.blocker_id = v_user and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = v_user)
      )
    order by
      case when p.name ilike v_q then 0 else 1 end,
      p.name
    limit p_limit;
end;
$$;

revoke all on function public.search_profiles(text, int) from public, anon;
grant execute on function public.search_profiles(text, int) to authenticated;


-- ============================ suggested_friends ============================
-- People you've played with (attended the same match) that aren't already your
-- friend, don't have a pending request either way, and aren't blocked. Ranked
-- by how many matches you shared.
create or replace function public.suggested_friends(p_limit int default 20)
returns table (
  id              uuid,
  name            text,
  photo_url       text,
  city            text,
  matches_shared  int
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
    with my_matches as (
      select match_id
      from public.match_participants
      where user_id = v_user
        and attendance in ('attended', 'substitute_in')
    ),
    candidates as (
      select mp.user_id, count(*)::int as shared
      from public.match_participants mp
      where mp.match_id in (select match_id from my_matches)
        and mp.user_id <> v_user
        and mp.attendance in ('attended', 'substitute_in')
      group by mp.user_id
    )
    select p.id, p.name, p.photo_url, p.city, c.shared
    from candidates c
    join public.profiles p on p.id = c.user_id
    where p.deleted_at is null
      and not exists (
        select 1 from public.friendships f
        where (f.requester_id = v_user and f.addressee_id = p.id)
           or (f.requester_id = p.id and f.addressee_id = v_user)
      )
      and not exists (
        select 1 from public.blocked_users b
        where (b.blocker_id = v_user and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = v_user)
      )
    order by c.shared desc, p.name
    limit p_limit;
end;
$$;

revoke all on function public.suggested_friends(int) from public, anon;
grant execute on function public.suggested_friends(int) to authenticated;
