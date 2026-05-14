-- =============================================================================
-- REMOVE "attitude" REVIEW CATEGORY
-- =============================================================================
-- A categoria attitude sobrepunha-se a fair_play. Removemo-la das reviews,
-- self_ratings, vistas agregadas e RPCs. As médias passam a ser sobre 3
-- categorias (fair_play, punctuality, technical_level).

-- 1. Drop dependent views first (CASCADE on the column would also work, but
--    being explicit avoids surprises).
drop view if exists public.review_aggregates;
drop view if exists public.self_rating_deltas cascade;

-- 2. Drop the column from both tables.
alter table public.reviews      drop column if exists attitude;
alter table public.self_ratings drop column if exists attitude;

-- 3. Recreate review_aggregates over the 3 remaining categories.
create view public.review_aggregates as
select
  reviewed_id            as user_id,
  count(*)               as total_reviews,
  avg(fair_play)         as avg_fair_play,
  avg(punctuality)       as avg_punctuality,
  avg(technical_level)   as avg_technical_level
from public.reviews
where comment_moderation_status <> 'rejected'
  and visible_at is not null
  and visible_at <= now()
group by reviewed_id;

-- 4. Recreate self_rating_deltas over 3 categories.
create view public.self_rating_deltas as
select
  sr.user_id,
  sr.match_id,
  sr.fair_play       as self_fair_play,
  sr.punctuality     as self_punctuality,
  sr.technical_level as self_technical_level,
  sr.created_at      as self_at,
  sr.comment         as self_comment,
  round(coalesce(avg(r.fair_play),       0)::numeric, 1) as others_fair_play,
  round(coalesce(avg(r.punctuality),     0)::numeric, 1) as others_punctuality,
  round(coalesce(avg(r.technical_level), 0)::numeric, 1) as others_technical_level,
  count(r.id)::int as review_count,
  round((
    (sr.fair_play       - coalesce(avg(r.fair_play),       sr.fair_play))
  + (sr.punctuality     - coalesce(avg(r.punctuality),     sr.punctuality))
  + (sr.technical_level - coalesce(avg(r.technical_level), sr.technical_level))
  ) / 3.0::numeric, 1) as avg_delta
from public.self_ratings sr
left join public.reviews r
  on r.reviewed_id = sr.user_id
 and r.match_id    = sr.match_id
group by sr.user_id, sr.match_id, sr.fair_play, sr.punctuality, sr.technical_level, sr.created_at, sr.comment;


-- 5. submit_self_rating — drop 5-arg, create 4-arg.
drop function if exists public.submit_self_rating(uuid, int, int, int, int, text);

create or replace function public.submit_self_rating(
  p_match_id uuid,
  p_fair_play       int,
  p_punctuality     int,
  p_technical_level int,
  p_comment         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.matches
    where id = p_match_id and status = 'validated'
  ) then
    raise exception 'Match must be validated';
  end if;

  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = v_user
      and attendance in ('attended', 'substitute_in')
  ) then
    raise exception 'You did not play in this match';
  end if;

  insert into public.self_ratings(
    user_id, match_id, fair_play, punctuality, technical_level, comment
  )
  values (
    v_user, p_match_id,
    least(5, greatest(1, p_fair_play)),
    least(5, greatest(1, p_punctuality)),
    least(5, greatest(1, p_technical_level)),
    nullif(trim(p_comment), '')
  )
  on conflict (user_id, match_id) do update set
    fair_play       = excluded.fair_play,
    punctuality     = excluded.punctuality,
    technical_level = excluded.technical_level,
    comment         = excluded.comment,
    updated_at      = now();
end;
$$;

revoke all on function public.submit_self_rating(uuid, int, int, int, text) from public, anon;
grant execute on function public.submit_self_rating(uuid, int, int, int, text) to authenticated;


-- 6. submit_referee_review — drop 6-arg, create 5-arg.
drop function if exists public.submit_referee_review(uuid, int, int, int, int, text);

create or replace function public.submit_referee_review(
  p_match_id        uuid,
  p_fair_play       int,
  p_punctuality     int,
  p_technical_level int,
  p_comment         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_match record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select id, status, referee_id into v_match
    from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if v_match.referee_id is null then
    raise exception 'This match has no referee';
  end if;
  if v_match.referee_id = v_user then
    raise exception 'Cannot review yourself as the referee';
  end if;
  if v_match.status <> 'validated' then
    raise exception 'Match must be validated first';
  end if;

  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = v_user
      and attendance in ('attended', 'substitute_in')
  ) then
    raise exception 'Only players who attended can review the referee';
  end if;

  insert into public.reviews(
    match_id, reviewer_id, reviewed_id, role,
    fair_play, punctuality, technical_level, comment,
    visible_at
  )
  values (
    p_match_id, v_user, v_match.referee_id, 'referee'::review_role,
    least(5, greatest(1, p_fair_play)),
    least(5, greatest(1, p_punctuality)),
    least(5, greatest(1, p_technical_level)),
    nullif(trim(p_comment), ''),
    now()
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.submit_referee_review(uuid, int, int, int, text) from public, anon;
grant execute on function public.submit_referee_review(uuid, int, int, int, text) to authenticated;


-- 7. fetch_user_rating_history — divide by 3 now.
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
      select mp.match_id as m_id, mp.side
      from public.match_participants mp
      where mp.user_id = p_user_id
        and mp.attendance in ('attended','substitute_in')
    ),
    rated as (
      select
        r.match_id as m_id,
        round((avg(r.fair_play) + avg(r.punctuality)
             + avg(r.technical_level)) / 3.0::numeric, 1) as avg_r,
        count(*)::int as r_count
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
      rd.avg_r,
      rd.r_count
    from my_rows mr
    join rated rd on rd.m_id = mr.m_id
    join public.matches m on m.id = mr.m_id
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


-- 8. my_self_rating_summary — divide by 3.
create or replace function public.my_self_rating_summary()
returns table (
  rated_matches      int,
  avg_self           numeric,
  avg_others         numeric,
  avg_delta          numeric,
  divergent_matches  int
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
    with d as (
      select * from public.self_rating_deltas where user_id = v_user
    )
    select
      count(*)::int as rated_matches,
      round(avg((self_fair_play + self_punctuality + self_technical_level) / 3.0)::numeric, 1) as avg_self,
      round(avg((others_fair_play + others_punctuality + others_technical_level) / 3.0)
            filter (where review_count > 0)::numeric, 1) as avg_others,
      round(coalesce(avg(avg_delta) filter (where review_count > 0), 0)::numeric, 1) as avg_delta,
      count(*) filter (where abs(avg_delta) >= 1.0 and review_count >= 3)::int as divergent_matches
    from d;
end;
$$;

revoke all on function public.my_self_rating_summary() from public, anon;
grant execute on function public.my_self_rating_summary() to authenticated;


-- 9. fetch_my_self_rating_history — divide by 3.
create or replace function public.fetch_my_self_rating_history(p_limit int default 30)
returns table (
  match_id               uuid,
  scheduled_at           timestamptz,
  side_a_name            text,
  side_b_name            text,
  final_score_a          int,
  final_score_b          int,
  self_avg               numeric,
  others_avg             numeric,
  avg_delta              numeric,
  review_count           int,
  self_at                timestamptz
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
    select
      m.id,
      m.scheduled_at,
      ta.name,
      tb.name,
      m.final_score_a,
      m.final_score_b,
      round(((d.self_fair_play + d.self_punctuality + d.self_technical_level) / 3.0)::numeric, 1) as self_avg,
      round(((d.others_fair_play + d.others_punctuality + d.others_technical_level) / 3.0)::numeric, 1) as others_avg,
      d.avg_delta,
      d.review_count,
      d.self_at
    from public.self_rating_deltas d
    join public.matches m on m.id = d.match_id
    join public.match_sides msa on msa.match_id = m.id and msa.side = 'A'
    join public.match_sides msb on msb.match_id = m.id and msb.side = 'B'
    join public.teams ta on ta.id = msa.team_id
    join public.teams tb on tb.id = msb.team_id
    where d.user_id = v_user
    order by m.scheduled_at desc
    limit p_limit;
end;
$$;

revoke all on function public.fetch_my_self_rating_history(int) from public, anon;
grant execute on function public.fetch_my_self_rating_history(int) to authenticated;
