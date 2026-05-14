-- =============================================================================
-- 0082 — Reviews overhaul: só MVP + capitão avalia equipa adversária
-- =============================================================================
-- Decisão de produto (2026-05-14):
--   * Reviews individuais entre colegas (estrela + comentário) deixam de
--     existir no fluxo. Dados históricos preservados em `public.reviews`,
--     mas nenhum novo insert via UI.
--   * Em jogos AMIGÁVEIS, só o capitão da própria side pode avaliar a equipa
--     adversária (1 estrela + comentário, via `team_reviews`).
--   * Em PELADINHAS internas, não há team-review (mesma equipa). MVP voting
--     fica disponível para ambos os tipos de jogo — política RLS já o permitia.
--
-- Esta migration NÃO mexe em `match_mvp_votes` (já permitia internal) nem
-- na tabela `reviews` (histórico mantém-se). Só restringe `submit_team_review`.

-- Helper SQL: é o user capitão da sua side neste match?
create or replace function public.is_match_captain(
  p_match_id uuid,
  p_user_id  uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.match_sides
    where match_id = p_match_id
      and captain_id = p_user_id
  )
$$;

grant execute on function public.is_match_captain(uuid, uuid) to authenticated;

-- Helper: é o user capitão da sua side E p_reviewed_team é a side adversária?
create or replace function public.can_review_opponent_team(
  p_match_id         uuid,
  p_reviewed_team_id uuid,
  p_user_id          uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_sides my
    join public.match_sides opp
      on opp.match_id = my.match_id
     and opp.side <> my.side
    where my.match_id  = p_match_id
      and my.captain_id = p_user_id
      and opp.team_id   = p_reviewed_team_id
  )
$$;

grant execute on function public.can_review_opponent_team(uuid, uuid, uuid) to authenticated;

-- Re-create submit_team_review com:
--   1) bloqueio em jogos peladinha (is_internal)
--   2) check de capitão da MINHA side E team_id ser a side adversária
create or replace function public.submit_team_review(
  p_match_id uuid,
  p_team_id  uuid,
  p_overall  int,
  p_comment  text default null
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

  if exists (
    select 1 from public.matches
    where id = p_match_id and is_internal = true
  ) then
    raise exception 'Peladinhas internas não têm avaliação de equipa adversária';
  end if;

  if not public.can_review_opponent_team(p_match_id, p_team_id, v_me) then
    raise exception 'Só o capitão da tua equipa pode avaliar a equipa adversária';
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
