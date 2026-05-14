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

-- 7) Replace aggregate view com o novo algoritmo
drop view if exists public.player_stats_aggregate;
create view public.player_stats_aggregate as
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
