-- ============================================================================
-- Promover user real a capitão + criar 2 jogos futuros (peladinha + amigável)
-- para testar o flow de substitutos
-- ============================================================================

do $$
declare
  v_user        uuid;
  v_bombs       uuid;
  v_old_captain uuid;
  v_opp         uuid;
  v_match_id    uuid;
  v_members     uuid[];
  k int;
begin
  -- Identificar user real
  select p.id into v_user
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email not like 'fake%@jogadalimpa.local' and p.deleted_at is null
  order by p.created_at desc limit 1;
  if v_user is null then raise exception 'User real não encontrado'; end if;

  -- Bombs FC
  select id, captain_id into v_bombs, v_old_captain
  from public.teams where name = 'Bombs FC' limit 1;
  if v_bombs is null then raise exception 'Bombs FC não existe'; end if;

  -- Garante que o user real é member primeiro
  insert into public.team_members (team_id, user_id, role)
  values (v_bombs, v_user, 'captain')
  on conflict (team_id, user_id) do update set role = 'captain';

  -- Despromove o captain antigo (se diferente) para member
  if v_old_captain is not null and v_old_captain <> v_user then
    update public.team_members
      set role = 'member'
      where team_id = v_bombs and user_id = v_old_captain;
  end if;

  -- Atualiza captain_id da equipa
  update public.teams set captain_id = v_user where id = v_bombs;

  -- ===== Peladinha 7v7 (daqui a 2 dias, 19h) =====
  insert into public.matches (
    sport_id, scheduled_at, location_name, status,
    proposed_by, message, is_internal,
    side_a_label, side_b_label
  ) values (
    2, date_trunc('day', now()) + interval '2 days' + interval '19 hours',
    'Campo do Calhabé', 'confirmed',
    v_user, 'Peladinha de teste', true,
    'Coletes', 'Sem Coletes'
  ) returning id into v_match_id;

  insert into public.match_sides (match_id, side, team_id, captain_id) values
    (v_match_id, 'A', v_bombs, v_user),
    (v_match_id, 'B', v_bombs, v_user);

  -- Sorteia 14 membros da Bombs FC e mete 7+7
  select array_agg(user_id) into v_members
  from (select user_id from public.team_members where team_id = v_bombs
        and user_id <> v_user
        order by random() limit 14) x;

  -- Mete o user real do lado A primeiro
  insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
  values (v_match_id, v_user, 'A', 'accepted', null) on conflict do nothing;

  -- Coletes (A): primeiros 6 fakes
  for k in 1..6 loop
    insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
    values (v_match_id, v_members[k], 'A', 'accepted', null) on conflict do nothing;
  end loop;
  -- Sem Coletes (B): próximos 7 fakes
  for k in 7..13 loop
    insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
    values (v_match_id, v_members[k], 'B', 'accepted', null) on conflict do nothing;
  end loop;

  -- Simular 1 jogador que recusou (gera o card "1 jogador não vai")
  update public.match_participants
    set invitation_status = 'declined'
    where match_id = v_match_id and user_id = v_members[13];


  -- ===== Amigável Bombs FC vs Solum Stars (daqui a 4 dias, 20h) =====
  select id into v_opp from public.teams where name = 'Solum Stars' limit 1;

  insert into public.matches (
    sport_id, scheduled_at, location_name, status,
    proposed_by, message, is_internal
  ) values (
    2, date_trunc('day', now()) + interval '4 days' + interval '20 hours',
    'Campo Municipal de Celas', 'confirmed',
    v_user, 'Amigável de teste', false
  ) returning id into v_match_id;

  insert into public.match_sides (match_id, side, team_id, captain_id) values
    (v_match_id, 'A', v_bombs, v_user),
    (v_match_id, 'B', v_opp, (select captain_id from public.teams where id = v_opp));

  -- User real no lado A
  insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
  values (v_match_id, v_user, 'A', 'accepted', null) on conflict do nothing;

  -- + 6 da Bombs FC
  select array_agg(user_id) into v_members
  from (select user_id from public.team_members where team_id = v_bombs
        and user_id <> v_user
        order by random() limit 6) x;
  for k in 1..6 loop
    insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
    values (v_match_id, v_members[k], 'A', 'accepted', null) on conflict do nothing;
  end loop;

  -- 7 da Solum Stars
  select array_agg(user_id) into v_members
  from (select user_id from public.team_members where team_id = v_opp order by random() limit 7) x;
  for k in 1..7 loop
    insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
    values (v_match_id, v_members[k], 'B', 'accepted', null) on conflict do nothing;
  end loop;
end $$;

-- Verificação
select 'real_user_id' as kind, (select p.id::text from public.profiles p
  join auth.users u on u.id = p.id
  where u.email not like 'fake%@jogadalimpa.local' and p.deleted_at is null
  order by p.created_at desc limit 1) as value
union all
select 'bombs_captain', (select captain_id::text from public.teams where name = 'Bombs FC')
union all
select 'future_matches', (select count(*)::text from public.matches
  where status = 'confirmed' and scheduled_at > now());


-- ============================================================================
-- 0082 — Reviews overhaul: só MVP + capitão avalia equipa adversária
-- ============================================================================
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
