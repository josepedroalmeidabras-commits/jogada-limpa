-- =============================================================================
-- OPTIONAL REFEREE
-- =============================================================================
-- Sempre opcional — a maioria dos jogos amadores não tem árbitro.
-- Quando há, qualquer profile (incluindo um jogador "convidado") pode ser o
-- árbitro. Reviews ao árbitro usam o role='referee' já existente no enum.

alter table public.matches
  add column if not exists referee_id uuid references public.profiles(id);

create index if not exists idx_matches_referee on public.matches(referee_id) where referee_id is not null;


-- ============================ set_match_referee ============================
create or replace function public.set_match_referee(
  p_match_id   uuid,
  p_referee_id uuid  -- null para limpar
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_status match_status;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if v_status in ('cancelled') then
    raise exception 'Match is cancelled';
  end if;

  if not exists (
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) then
    raise exception 'Only an involved captain can set the referee';
  end if;

  if p_referee_id is not null and not exists (
    select 1 from public.profiles where id = p_referee_id and deleted_at is null
  ) then
    raise exception 'Referee profile not found';
  end if;

  update public.matches
    set referee_id = p_referee_id
    where id = p_match_id;
end;
$$;

revoke all on function public.set_match_referee(uuid, uuid) from public, anon;
grant execute on function public.set_match_referee(uuid, uuid) to authenticated;


-- ============================ submit_referee_review =======================
-- Quem participou (qualquer lado) pode avaliar o árbitro depois do jogo
-- validado. Reutiliza a tabela reviews, role='referee'.
create or replace function public.submit_referee_review(
  p_match_id        uuid,
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
  v_user       uuid := auth.uid();
  v_match      record;
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

  -- must have attended the match
  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = v_user
      and attendance in ('attended', 'substitute_in')
  ) then
    raise exception 'Only players who attended can review the referee';
  end if;

  insert into public.reviews(
    match_id, reviewer_id, reviewed_id, role,
    fair_play, punctuality, technical_level, attitude, comment,
    visible_at
  )
  values (
    p_match_id, v_user, v_match.referee_id, 'referee'::review_role,
    least(5, greatest(1, p_fair_play)),
    least(5, greatest(1, p_punctuality)),
    least(5, greatest(1, p_technical_level)),
    least(5, greatest(1, p_attitude)),
    nullif(trim(p_comment), ''),
    now()
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.submit_referee_review(uuid, int, int, int, int, text) from public, anon;
grant execute on function public.submit_referee_review(uuid, int, int, int, int, text) to authenticated;
