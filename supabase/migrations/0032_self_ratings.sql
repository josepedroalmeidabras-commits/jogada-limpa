-- =============================================================================
-- SELF-RATINGS — jogador avalia-se a si próprio + comparação com agregado
-- =============================================================================
-- Após cada jogo validado, o jogador pode dar-se notas (mesmas 4 categorias
-- das reviews). A view `self_rating_deltas` compara self vs média dos outros
-- — útil para criar dinâmica social ("achaste 5/5 mas a malta deu 3/5").

create table if not exists public.self_ratings (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  match_id         uuid not null references public.matches(id) on delete cascade,
  fair_play        smallint not null check (fair_play       between 1 and 5),
  punctuality      smallint not null check (punctuality     between 1 and 5),
  technical_level  smallint not null check (technical_level between 1 and 5),
  attitude         smallint not null check (attitude        between 1 and 5),
  comment          text check (char_length(comment) <= 200),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  primary key (user_id, match_id)
);

create index if not exists idx_self_ratings_user on public.self_ratings(user_id);

alter table public.self_ratings enable row level security;

-- Read your own self-ratings only. Aggregates flow through the view (which
-- runs as security definer via the RPCs that consume it).
create policy "self_ratings_read_own"
  on public.self_ratings for select
  using (auth.uid() = user_id);
create policy "self_ratings_insert_own"
  on public.self_ratings for insert
  with check (auth.uid() = user_id);
create policy "self_ratings_update_own"
  on public.self_ratings for update
  using (auth.uid() = user_id);


-- ============================ submit_self_rating ============================
create or replace function public.submit_self_rating(
  p_match_id uuid,
  p_fair_play       int,
  p_punctuality     int,
  p_technical_level int,
  p_attitude        int,
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

  -- match must be validated
  if not exists (
    select 1 from public.matches
    where id = p_match_id and status = 'validated'
  ) then
    raise exception 'Match must be validated';
  end if;

  -- I must have actually participated
  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = v_user
      and attendance in ('attended', 'substitute_in')
  ) then
    raise exception 'You did not play in this match';
  end if;

  insert into public.self_ratings(
    user_id, match_id, fair_play, punctuality, technical_level, attitude, comment
  )
  values (
    v_user, p_match_id,
    least(5, greatest(1, p_fair_play)),
    least(5, greatest(1, p_punctuality)),
    least(5, greatest(1, p_technical_level)),
    least(5, greatest(1, p_attitude)),
    nullif(trim(p_comment), '')
  )
  on conflict (user_id, match_id) do update set
    fair_play       = excluded.fair_play,
    punctuality     = excluded.punctuality,
    technical_level = excluded.technical_level,
    attitude        = excluded.attitude,
    comment         = excluded.comment,
    updated_at      = now();
end;
$$;

revoke all on function public.submit_self_rating(uuid, int, int, int, int, text) from public, anon;
grant execute on function public.submit_self_rating(uuid, int, int, int, int, text) to authenticated;


-- ============================ view: self_rating_deltas =====================
-- For each (user, match): self values, others' aggregate, delta, review count.
create or replace view public.self_rating_deltas as
select
  sr.user_id,
  sr.match_id,
  sr.fair_play       as self_fair_play,
  sr.punctuality     as self_punctuality,
  sr.technical_level as self_technical_level,
  sr.attitude        as self_attitude,
  sr.created_at      as self_at,
  sr.comment         as self_comment,
  -- aggregate from others
  round(coalesce(avg(r.fair_play),       0)::numeric, 1) as others_fair_play,
  round(coalesce(avg(r.punctuality),     0)::numeric, 1) as others_punctuality,
  round(coalesce(avg(r.technical_level), 0)::numeric, 1) as others_technical_level,
  round(coalesce(avg(r.attitude),        0)::numeric, 1) as others_attitude,
  count(r.id)::int as review_count,
  -- average delta across the 4 categories (positive = self higher than others)
  round((
    (sr.fair_play       - coalesce(avg(r.fair_play),       sr.fair_play))
  + (sr.punctuality     - coalesce(avg(r.punctuality),     sr.punctuality))
  + (sr.technical_level - coalesce(avg(r.technical_level), sr.technical_level))
  + (sr.attitude        - coalesce(avg(r.attitude),        sr.attitude))
  ) / 4.0::numeric, 1) as avg_delta
from public.self_ratings sr
left join public.reviews r
  on r.reviewed_id = sr.user_id
 and r.match_id    = sr.match_id
group by sr.user_id, sr.match_id, sr.fair_play, sr.punctuality, sr.technical_level, sr.attitude, sr.created_at, sr.comment;

-- RLS bypass via security_invoker=false (default), but the underlying tables
-- have RLS; for now we expose only via security-definer RPC.

-- ============================ my_self_rating_summary =======================
-- Aggregates the user's self-rating dynamics across all their matches.
create or replace function public.my_self_rating_summary()
returns table (
  rated_matches      int,
  avg_self           numeric,
  avg_others         numeric,
  avg_delta          numeric,
  divergent_matches  int  -- |avg_delta| >= 1.0 AND review_count >= 3
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
      count(*)::int                                                                      as rated_matches,
      round(avg((self_fair_play + self_punctuality + self_technical_level + self_attitude) / 4.0)::numeric, 1) as avg_self,
      round(avg((others_fair_play + others_punctuality + others_technical_level + others_attitude) / 4.0) filter (where review_count > 0)::numeric, 1) as avg_others,
      round(coalesce(avg(avg_delta) filter (where review_count > 0), 0)::numeric, 1)     as avg_delta,
      count(*) filter (where abs(avg_delta) >= 1.0 and review_count >= 3)::int           as divergent_matches
    from d;
end;
$$;

revoke all on function public.my_self_rating_summary() from public, anon;
grant execute on function public.my_self_rating_summary() to authenticated;


-- ============================ fetch_my_self_rating_history =================
-- Lists per-match deltas so the UI can render a "discrepâncias" list.
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
      round(((d.self_fair_play + d.self_punctuality + d.self_technical_level + d.self_attitude) / 4.0)::numeric, 1) as self_avg,
      round(((d.others_fair_play + d.others_punctuality + d.others_technical_level + d.others_attitude) / 4.0)::numeric, 1) as others_avg,
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
