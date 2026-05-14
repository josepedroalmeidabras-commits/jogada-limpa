-- =============================================================================
-- 0078 — Avaliações passam a ser estrela única (0-5) tipo Uber Eats
-- =============================================================================
-- As 3 categorias (fair_play/punctuality/technical_level) tornam-se 1 valor
-- "overall". Para manter compatibilidade com as colunas existentes (NOT NULL
-- check), continuamos a escrever o mesmo valor nas 3 cols quando o user
-- submete uma estrela única. UI mostra apenas `avg_overall`.

alter table public.reviews
  add column if not exists overall int check (overall between 1 and 5);

alter table public.team_reviews
  add column if not exists overall int check (overall between 1 and 5);

-- Backfill com média arredondada das 3 categorias existentes
update public.reviews
set overall = round((fair_play + punctuality + technical_level) / 3.0)
where overall is null;

update public.team_reviews
set overall = round((fair_play + punctuality + technical_level) / 3.0)
where overall is null;

-- View `review_aggregates` agora expõe avg_overall
drop view if exists public.review_aggregates;
create view public.review_aggregates as
select
  reviewed_id            as user_id,
  count(*)               as total_reviews,
  avg(coalesce(overall, (fair_play + punctuality + technical_level) / 3.0)) as avg_overall,
  avg(fair_play)         as avg_fair_play,
  avg(punctuality)       as avg_punctuality,
  avg(technical_level)   as avg_technical_level
from public.reviews
where comment_moderation_status <> 'rejected'
  and visible_at is not null
  and visible_at <= now()
group by reviewed_id;

grant select on public.review_aggregates to authenticated, anon;

-- View `team_review_aggregates` igual
drop view if exists public.team_review_aggregates;
create view public.team_review_aggregates as
select
  reviewed_team_id as team_id,
  count(*)::int    as total_reviews,
  avg(coalesce(overall, (fair_play + punctuality + technical_level) / 3.0)) as avg_overall,
  avg(fair_play)        as avg_fair_play,
  avg(punctuality)      as avg_punctuality,
  avg(technical_level)  as avg_technical_level
from public.team_reviews
where comment_moderation_status <> 'rejected'
  and visible_at is not null
  and visible_at <= now()
group by reviewed_team_id;

grant select on public.team_review_aggregates to authenticated, anon;

-- RPC `submit_team_review` aceita `p_overall` (escreve nas 4 cols)
create or replace function public.submit_team_review(
  p_match_id         uuid,
  p_team_id          uuid,
  p_overall          int,
  p_comment          text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_val int  := least(5, greatest(1, p_overall));
begin
  if v_me is null then raise exception 'Sem sessão'; end if;
  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = v_me
  ) then
    raise exception 'Não participaste neste jogo';
  end if;

  insert into public.team_reviews (
    match_id, reviewer_id, reviewed_team_id,
    fair_play, punctuality, technical_level, overall, comment,
    visible_at
  )
  values (
    p_match_id, v_me, p_team_id,
    v_val, v_val, v_val, v_val, p_comment,
    now()
  )
  on conflict (match_id, reviewer_id, reviewed_team_id) do update
  set fair_play       = excluded.fair_play,
      punctuality     = excluded.punctuality,
      technical_level = excluded.technical_level,
      overall         = excluded.overall,
      comment         = excluded.comment,
      submitted_at    = now();
end;
$$;

grant execute on function public.submit_team_review(uuid, uuid, int, text) to authenticated;
