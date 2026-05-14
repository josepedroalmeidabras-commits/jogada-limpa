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
-- 0082_mvp_only_reviews
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


-- ============================================================================
-- 0083_stats_friends_seasonal
-- ============================================================================
-- =============================================================================
-- 0083 — Stats votes: friends-only + seasonal (1x/época) + Elo-light algorithm
-- =============================================================================
-- Decisão de produto (2026-05-14):
--   * Só AMIGOS podem votar nos atributos uns dos outros (substitui o
--     teammate check antigo). Self-rating continua a existir como baseline.
--   * 1 voto por categoria por época civil (`season`, ex: '2026'). Para
--     mudar de opinião, o amigo espera a próxima época.
--   * Agregado calculado com algoritmo Elo-light: baseline 50 (ou self-vote),
--     K-factor 0.3, clamp ±5 por voto, decay linear até 0.2 aos 12 meses.
--   * Votos existentes (pré-mudança) ficam com `season='2025'` (legado, com
--     decay máximo) — continuam a contar mas com peso baixo.

-- 1) Coluna season + reset da PK
alter table public.player_stat_votes
  add column if not exists season text;

update public.player_stat_votes
set season = '2025'
where season is null;

alter table public.player_stat_votes
  alter column season set not null,
  alter column season set default to_char(now(), 'YYYY');

alter table public.player_stat_votes drop constraint if exists player_stat_votes_pkey;
alter table public.player_stat_votes
  add constraint player_stat_votes_pkey primary key (voter_id, target_id, category, season);

-- 2) Helper is_friend
create or replace function public.is_friend(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = p_a and addressee_id = p_b)
        or (requester_id = p_b and addressee_id = p_a)
      )
  )
$$;

grant execute on function public.is_friend(uuid, uuid) to authenticated;

-- 3) has_voted_this_season helper (UI usa para gate)
create or replace function public.has_voted_this_season(
  p_target_id uuid,
  p_category  text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.player_stat_votes
    where voter_id  = auth.uid()
      and target_id = p_target_id
      and category  = p_category::player_stat_category
      and season    = to_char(now(), 'YYYY')
  )
$$;

grant execute on function public.has_voted_this_season(uuid, text) to authenticated;

-- 4) Rewrite set_my_stat_vote: friends-only, 1x/época
create or replace function public.set_my_stat_vote(
  p_target_id uuid,
  p_category  text,
  p_value     smallint
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_season text := to_char(now(), 'YYYY');
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_value < 1 or p_value > 99 then raise exception 'Value must be between 1 and 99'; end if;

  -- Self-vote: sempre permitido, upsertable (baseline da época)
  if v_user = p_target_id then
    insert into public.player_stat_votes(voter_id, target_id, category, value, season)
    values (v_user, p_target_id, p_category::player_stat_category, p_value, v_season)
    on conflict (voter_id, target_id, category, season)
    do update set value = excluded.value, updated_at = now();
    return;
  end if;

  -- Friend vote: 1x por categoria por época, sem updates
  if not public.is_friend(v_user, p_target_id) then
    raise exception 'Só amigos podem votar nos atributos deste jogador';
  end if;

  if exists(
    select 1 from public.player_stat_votes
    where voter_id  = v_user
      and target_id = p_target_id
      and category  = p_category::player_stat_category
      and season    = v_season
  ) then
    raise exception 'Já votaste nesta categoria em %, volta em %', v_season, ((v_season::int) + 1)::text;
  end if;

  insert into public.player_stat_votes(voter_id, target_id, category, value, season)
  values (v_user, p_target_id, p_category::player_stat_category, p_value, v_season);
end;
$$;

grant execute on function public.set_my_stat_vote(uuid, text, smallint) to authenticated;

-- 5) Rewrite can_vote_on_player: friend check
create or replace function public.can_vote_on_player(p_target_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  if v_user = p_target_id then return true; end if;
  return public.is_friend(v_user, p_target_id);
end;
$$;

grant execute on function public.can_vote_on_player(uuid) to authenticated;

-- 6) Elo-light aggregate function
--    baseline = self-vote (latest, qualquer época) ou 50
--    para cada friend-vote em ordem cronológica:
--      age_months  = idade do voto em meses
--      weight      = max(0.2, 1.0 - age/12)   -- decay linear
--      delta_raw   = (vote - current_agg) * 0.3   -- K-factor
--      delta_clamp = clamp(delta_raw, -5, +5) * weight
--      current_agg = current_agg + delta_clamp
--    return clamp(round(current_agg), 1, 99)
create or replace function public.compute_stat_aggregate(
  p_target_id uuid,
  p_category  text
) returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agg            numeric := 50;
  v_rec            record;
  v_age_months     numeric;
  v_weight         numeric;
  v_delta_raw      numeric;
  v_delta_clamped  numeric;
  v_count          int := 0;
  v_self           int;
begin
  -- Self-vote como baseline (qualquer época, mais recente)
  select value into v_self
  from public.player_stat_votes
  where voter_id  = p_target_id
    and target_id = p_target_id
    and category  = p_category::player_stat_category
  order by coalesce(updated_at, created_at) desc
  limit 1;

  if v_self is not null then
    v_agg := v_self;
    v_count := 1;
  end if;

  -- Friend votes em ordem cronológica
  for v_rec in
    select value, coalesce(updated_at, created_at) as ts
    from public.player_stat_votes
    where target_id = p_target_id
      and voter_id  <> p_target_id
      and category  = p_category::player_stat_category
    order by coalesce(updated_at, created_at) asc
  loop
    v_count := v_count + 1;
    v_age_months    := extract(epoch from (now() - v_rec.ts)) / (60.0 * 60 * 24 * 30);
    v_weight        := greatest(0.2, 1.0 - v_age_months / 12.0);
    v_delta_raw     := (v_rec.value - v_agg) * 0.3;
    v_delta_clamped := greatest(-5.0, least(5.0, v_delta_raw)) * v_weight;
    v_agg           := v_agg + v_delta_clamped;
  end loop;

  if v_count = 0 then return null; end if;
  return greatest(1, least(99, round(v_agg)::int));
end;
$$;

grant execute on function public.compute_stat_aggregate(uuid, text) to authenticated, anon;

-- 7) Replace aggregate view com o novo algoritmo (CREATE OR REPLACE — colunas
-- iguais às originais, evita cascade conflicts com team_stats_aggregate)
create or replace view public.player_stats_aggregate as
select
  target_id                                                    as user_id,
  category::text                                               as category,
  public.compute_stat_aggregate(target_id, category::text)     as value,
  count(*)::int                                                as votes
from public.player_stat_votes
group by target_id, category;

grant select on public.player_stats_aggregate to authenticated, anon;

-- 8) pending_stat_vote_friends — amigos cujos atributos eu ainda não votei esta época
create or replace function public.pending_stat_vote_friends(p_limit int default 6)
returns table (
  user_id   uuid,
  name      text,
  photo_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me     uuid := auth.uid();
  v_season text := to_char(now(), 'YYYY');
begin
  if v_me is null then return; end if;
  return query
  with my_friends as (
    select case when requester_id = v_me then addressee_id else requester_id end as friend_id
    from public.friendships
    where status = 'accepted'
      and (requester_id = v_me or addressee_id = v_me)
  ),
  voted_this_season as (
    select target_id
    from public.player_stat_votes
    where voter_id = v_me and season = v_season
    group by target_id
  )
  select p.id, p.name, p.photo_url
  from my_friends f
  join public.profiles p on p.id = f.friend_id
  where p.deleted_at is null
    and f.friend_id not in (select target_id from voted_this_season)
  order by p.name
  limit p_limit;
end;
$$;

grant execute on function public.pending_stat_vote_friends(int) to authenticated;


-- ============================================================================
-- 0084_backend_hardening
-- ============================================================================
-- =============================================================================
-- 0084 — Backend hardening pre-launch (audit fixes)
-- =============================================================================
-- Fixes do audit de 2026-05-14, focados nos pontos que afectam integridade
-- de dados antes do lançamento público.
--
--   #4 (🟠) `submit_match_side_result` não rejeitava participants cujo
--          user_id não pertence ao roster da side (UPDATE silencioso filtrava
--          falsos UUIDs, mas capitão podia atribuir golos a jogadores
--          convidados/não-presentes sem qualquer aviso).
--   #6 (🟡) View `player_stats_aggregate` não filtrava `profiles.deleted_at`.
--   #7 (🟡) View `team_review_aggregates` não filtrava matches `disputed`/
--          `cancelled` — reviews de jogos contestados contavam.
--
-- Os outros achados do audit (race condition em accept_substitute_request,
-- review_aggregates "leak", is_friend) são falsos positivos após verificação.

-- ─── #4: submit_match_side_result com validação estrita de participants ────
create or replace function public.submit_match_side_result(
  p_match_id     uuid,
  p_score_a      int,
  p_score_b      int,
  p_participants jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_status      match_status;
  v_side        side;
  v_row         jsonb;
  v_uid         uuid;
  v_attended    boolean;
  v_goals       int;
  v_assists     int;
  v_total_goals int := 0;
  v_total_assists int := 0;
  v_my_score    int;
  v_unknown_uid uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
    raise exception 'Scores têm de ser inteiros não-negativos';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then raise exception 'Jogo não existe'; end if;
  if v_status not in ('confirmed', 'result_pending', 'disputed') then
    raise exception 'Jogo não está pronto para resultado';
  end if;

  select side into v_side from public.match_sides
    where match_id = p_match_id and captain_id = v_user;
  if not found then raise exception 'Só capitães podem submeter resultado'; end if;

  -- Pré-validação 1: cada user_id em p_participants TEM de estar em
  --   match_participants para este match e este side. Bloqueia UUIDs
  --   fantasma + atribuição cruzada de side adversária.
  if p_participants is not null then
    select (v_row->>'user_id')::uuid into v_unknown_uid
    from jsonb_array_elements(p_participants) v_row
    where not exists (
      select 1 from public.match_participants mp
      where mp.match_id = p_match_id
        and mp.side     = v_side
        and mp.user_id  = (v_row->>'user_id')::uuid
    )
    limit 1;

    if v_unknown_uid is not null then
      raise exception 'Participant % não pertence ao roster da equipa neste jogo',
        v_unknown_uid;
    end if;
  end if;

  -- Pré-validação 2: soma golos/assists não excede score do lado
  if p_participants is not null then
    for v_row in select * from jsonb_array_elements(p_participants) loop
      v_goals   := greatest(0, coalesce((v_row->>'goals')::int, 0));
      v_assists := greatest(0, coalesce((v_row->>'assists')::int, 0));
      v_total_goals := v_total_goals + v_goals;
      v_total_assists := v_total_assists + v_assists;
    end loop;
  end if;

  v_my_score := case when v_side = 'A'::side then p_score_a else p_score_b end;

  if v_total_goals > v_my_score then
    raise exception 'Os golos individuais (%) não podem ultrapassar o resultado da equipa (%)',
      v_total_goals, v_my_score;
  end if;
  if v_total_assists > v_my_score then
    raise exception 'As assistências individuais (%) não podem ultrapassar o resultado da equipa (%)',
      v_total_assists, v_my_score;
  end if;

  -- Reset baseline
  update public.match_participants
    set attendance   = 'missed'::attendance,
        goals        = 0,
        assists      = 0,
        responded_at = now()
    where match_id = p_match_id and side = v_side;

  -- Aplicar dados (já validados acima)
  if p_participants is not null then
    for v_row in select * from jsonb_array_elements(p_participants) loop
      v_uid      := (v_row->>'user_id')::uuid;
      v_attended := coalesce((v_row->>'attended')::boolean, true);
      v_goals    := greatest(0, coalesce((v_row->>'goals')::int, 0));
      v_assists  := greatest(0, coalesce((v_row->>'assists')::int, 0));

      update public.match_participants
        set attendance = case when v_attended then 'attended'::attendance else 'missed'::attendance end,
            goals      = v_goals,
            assists    = v_assists,
            responded_at = now()
        where match_id = p_match_id and side = v_side and user_id = v_uid;
    end loop;
  end if;

  -- Score submission
  insert into public.match_score_submissions(
    match_id, submitted_by_side, score_a, score_b, submitted_by
  )
  values (p_match_id, v_side, p_score_a, p_score_b, v_user)
  on conflict (match_id, submitted_by_side) do update
    set score_a = excluded.score_a,
        score_b = excluded.score_b,
        submitted_by = excluded.submitted_by,
        submitted_at = now();

  update public.matches
    set status = 'result_pending'
    where id = p_match_id and status = 'confirmed';
end;
$$;

revoke all on function public.submit_match_side_result(uuid, int, int, jsonb) from public, anon;
grant execute on function public.submit_match_side_result(uuid, int, int, jsonb) to authenticated;

-- ─── #6: player_stats_aggregate exclui perfis soft-deleted ───────────────
-- CREATE OR REPLACE — colunas iguais, sem cascade conflicts
create or replace view public.player_stats_aggregate as
select
  v.target_id                                                  as user_id,
  v.category::text                                             as category,
  public.compute_stat_aggregate(v.target_id, v.category::text) as value,
  count(*)::int                                                as votes
from public.player_stat_votes v
join public.profiles p on p.id = v.target_id
where p.deleted_at is null
group by v.target_id, v.category;

grant select on public.player_stats_aggregate to authenticated, anon;

-- ─── #7: team_review_aggregates exclui matches disputed/cancelled ────────
create or replace view public.team_review_aggregates as
select
  tr.reviewed_team_id                                                          as team_id,
  count(*)::int                                                                as total_reviews,
  avg(coalesce(tr.overall, (tr.fair_play + tr.punctuality + tr.technical_level) / 3.0)) as avg_overall,
  avg(tr.fair_play)                                                            as avg_fair_play,
  avg(tr.punctuality)                                                          as avg_punctuality,
  avg(tr.technical_level)                                                      as avg_technical_level
from public.team_reviews tr
join public.matches m on m.id = tr.match_id
where tr.comment_moderation_status <> 'rejected'
  and tr.visible_at is not null
  and tr.visible_at <= now()
  and m.status not in ('disputed', 'cancelled')
group by tr.reviewed_team_id;

grant select on public.team_review_aggregates to authenticated, anon;

-- Bónus: review_aggregates (singular, individual users) com mesmo filtro
create or replace view public.review_aggregates as
select
  r.reviewed_id                                                                as user_id,
  count(*)::int                                                                as total_reviews,
  avg(coalesce(r.overall, (r.fair_play + r.punctuality + r.technical_level) / 3.0)) as avg_overall,
  avg(r.fair_play)                                                             as avg_fair_play,
  avg(r.punctuality)                                                           as avg_punctuality,
  avg(r.technical_level)                                                       as avg_technical_level
from public.reviews r
join public.matches m on m.id = r.match_id
join public.profiles p on p.id = r.reviewed_id
where r.comment_moderation_status <> 'rejected'
  and r.visible_at is not null
  and r.visible_at <= now()
  and m.status not in ('disputed', 'cancelled')
  and p.deleted_at is null
group by r.reviewed_id;

grant select on public.review_aggregates to authenticated, anon;


-- ============================================================================
-- 0085_rerun_encoding_fix
-- ============================================================================
-- =============================================================================
-- 0085 — Re-aplicar fix_macroman_encoding() em registos que escaparam ao 0076
-- =============================================================================
-- Algumas linhas (provavelmente criadas DEPOIS de 0076 ter corrido, ou por
-- pipeline alternativo) ainda têm "Andr√© Sousa" em vez de "André Sousa".
-- Idempotente: linhas já limpas (sem "√") são saltadas pelo WHERE.
--
-- Usamos chr(8730) em vez de literal Unicode "√" porque o SQL Editor da
-- Supabase pode renderizar mal o caractere copiado, levando a queries
-- que falsamente não matcham. chr() é à prova de cliente.

-- chr(8730) = √
update public.profiles
set name = public.fix_macroman_encoding(name)
where name like '%' || chr(8730) || '%';

update public.profiles
set nickname = public.fix_macroman_encoding(nickname)
where nickname like '%' || chr(8730) || '%';

update public.profiles
set bio = public.fix_macroman_encoding(bio)
where bio like '%' || chr(8730) || '%';

update public.profiles
set city = public.fix_macroman_encoding(city)
where city like '%' || chr(8730) || '%';

update public.teams
set name = public.fix_macroman_encoding(name)
where name like '%' || chr(8730) || '%';

update public.teams
set city = public.fix_macroman_encoding(city)
where city like '%' || chr(8730) || '%';

update public.matches
set location_name = public.fix_macroman_encoding(location_name)
where location_name like '%' || chr(8730) || '%';

-- Sports table (nomes de modalidades)
update public.sports
set name = public.fix_macroman_encoding(name)
where name like '%' || chr(8730) || '%';
