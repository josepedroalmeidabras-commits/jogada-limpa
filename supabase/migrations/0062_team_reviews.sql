-- =============================================================================
-- TEAM REVIEWS — substitui as reviews individuais aos jogadores adversários
-- =============================================================================
-- Em vez de avaliar 6 jogadores adversários que nem conheces, avalias a
-- equipa como um todo. Reviews aos teus colegas continuam individuais
-- (já os conheces). Mesmas 3 categorias: fair_play, punctuality,
-- technical_level. Comentário opcional, com moderação.

create table if not exists public.team_reviews (
  id                        uuid primary key default uuid_generate_v4(),
  match_id                  uuid not null references public.matches(id) on delete cascade,
  reviewer_id               uuid not null references public.profiles(id) on delete cascade,
  reviewed_team_id          uuid not null references public.teams(id)    on delete cascade,
  fair_play                 int  not null check (fair_play between 1 and 5),
  punctuality               int  not null check (punctuality between 1 and 5),
  technical_level           int  not null check (technical_level between 1 and 5),
  comment                   text check (char_length(comment) <= 200),
  comment_moderation_status moderation_status default 'pending',
  comment_moderation_score  jsonb,
  submitted_at              timestamptz default now(),
  visible_at                timestamptz,
  unique (match_id, reviewer_id, reviewed_team_id)
);

create index if not exists idx_team_reviews_team on public.team_reviews(reviewed_team_id);
create index if not exists idx_team_reviews_match on public.team_reviews(match_id);

alter table public.team_reviews enable row level security;

-- Read aggregated view publicly; individual rows only by the reviewer/reviewed
create policy "team_reviews_read_own"
  on public.team_reviews for select to authenticated
  using (
    reviewer_id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_reviews.reviewed_team_id
        and tm.user_id = auth.uid()
    )
  );

create policy "team_reviews_insert_own"
  on public.team_reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    -- reviewer must have attended this match
    and exists (
      select 1 from public.match_participants mp
      where mp.match_id = team_reviews.match_id
        and mp.user_id = auth.uid()
        and mp.attendance in ('attended', 'substitute_in')
    )
    -- match must be validated
    and exists (
      select 1 from public.matches m
      where m.id = team_reviews.match_id
        and m.status = 'validated'
    )
    -- reviewed team must be a side in the match AND not reviewer's own side
    and exists (
      select 1 from public.match_sides ms
      where ms.match_id = team_reviews.match_id
        and ms.team_id = team_reviews.reviewed_team_id
        and ms.side <> (
          select mp.side from public.match_participants mp
          where mp.match_id = team_reviews.match_id
            and mp.user_id = auth.uid()
          limit 1
        )
    )
  );


-- Aggregate per team
create or replace view public.team_review_aggregates as
select
  reviewed_team_id      as team_id,
  count(*)              as total_reviews,
  avg(fair_play)        as avg_fair_play,
  avg(punctuality)      as avg_punctuality,
  avg(technical_level)  as avg_technical_level
from public.team_reviews
where coalesce(comment_moderation_status, 'approved') <> 'rejected'
  and visible_at is not null
  and visible_at <= now()
group by reviewed_team_id;

grant select on public.team_review_aggregates to authenticated, anon;


-- ============================ submit_team_review ===========================
-- Helper RPC that wraps the insert with sensible defaults (visible_at = now()
-- since opponent-team reviews aren't bilateral — they go straight to public).
create or replace function public.submit_team_review(
  p_match_id         uuid,
  p_team_id          uuid,
  p_fair_play        int,
  p_punctuality      int,
  p_technical_level  int,
  p_comment          text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  insert into public.team_reviews (
    match_id, reviewer_id, reviewed_team_id,
    fair_play, punctuality, technical_level, comment,
    visible_at
  ) values (
    p_match_id, v_user, p_team_id,
    least(5, greatest(1, p_fair_play)),
    least(5, greatest(1, p_punctuality)),
    least(5, greatest(1, p_technical_level)),
    nullif(trim(p_comment), ''),
    now()
  )
  on conflict (match_id, reviewer_id, reviewed_team_id) do update set
    fair_play       = excluded.fair_play,
    punctuality     = excluded.punctuality,
    technical_level = excluded.technical_level,
    comment         = excluded.comment,
    submitted_at    = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_team_review(uuid, uuid, int, int, int, text) from public, anon;
grant execute on function public.submit_team_review(uuid, uuid, int, int, int, text) to authenticated;
