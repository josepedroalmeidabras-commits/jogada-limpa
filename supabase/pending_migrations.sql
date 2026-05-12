-- =============================================================================
-- Jogada Limpa — Migrations PENDENTES (0031 + 0032)
-- =============================================================================
-- 0031 — internal matches (peladinha)
-- 0032 — self-ratings + delta view + summary RPCs
-- =============================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0031_internal_matches.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- INTERNAL MATCHES — peladinha entre membros da mesma equipa
-- =============================================================================
-- O caso "grupo de amigos joga sábados à noite contra eles próprios" — não há
-- adversário externo, capitão divide o plantel em dois lados ad-hoc.
--
-- Modelado simplesmente:
--   matches.is_internal     boolean (default false)
--   match_sides ambas linhas com o mesmo team_id (PK já permite)
--   match_participants distribuídos por side='A' / side='B'
--   ELO NÃO se mexe em jogos internos — não faz sentido competitivo
--   Golos/assistências/MVP/reviews/fotos continuam todos a funcionar
--
-- Labels opcionais (ex: "Coletes" vs "Sem coletes") para a UI ficar com graça.

alter table public.matches
  add column if not exists is_internal      boolean default false not null,
  add column if not exists side_a_label     text,
  add column if not exists side_b_label     text;


-- ============================ create_internal_match ========================
-- O capitão cria um jogo interno e atribui jogadores aos dois lados de uma
-- só vez. O match nasce já em status 'confirmed'.
create or replace function public.create_internal_match(
  p_team_id        uuid,
  p_scheduled_at   timestamptz,
  p_location_name  text default null,
  p_location_tbd   boolean default false,
  p_notes          text default null,
  p_side_a_label   text default null,
  p_side_b_label   text default null,
  p_side_a_user_ids uuid[] default '{}'::uuid[],
  p_side_b_user_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_team  record;
  v_match uuid;
  v_uid   uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_scheduled_at is null then
    raise exception 'Scheduled date required';
  end if;

  select * into v_team from public.teams where id = p_team_id and is_active;
  if not found then
    raise exception 'Team not found';
  end if;
  if v_team.captain_id <> v_user then
    raise exception 'Only the team captain can create internal matches';
  end if;

  if array_length(p_side_a_user_ids, 1) is null or array_length(p_side_b_user_ids, 1) is null then
    raise exception 'Both sides need at least one player';
  end if;

  -- Validate that all proposed players are members of the team
  if exists (
    select unnest(p_side_a_user_ids || p_side_b_user_ids)
    except
    select user_id from public.team_members where team_id = p_team_id
  ) then
    raise exception 'All players must be members of the team';
  end if;

  -- No overlap between sides
  if exists (
    select 1
    from unnest(p_side_a_user_ids) a
    where a = any (p_side_b_user_ids)
  ) then
    raise exception 'A player cannot be on both sides';
  end if;

  insert into public.matches (
    sport_id, scheduled_at, location_name, location_tbd,
    status, proposed_by, notes,
    is_internal, side_a_label, side_b_label
  ) values (
    v_team.sport_id, p_scheduled_at, p_location_name, coalesce(p_location_tbd, false),
    'confirmed', v_user, p_notes,
    true,
    coalesce(nullif(trim(p_side_a_label), ''), 'Coletes'),
    coalesce(nullif(trim(p_side_b_label), ''), 'Sem coletes')
  )
  returning id into v_match;

  -- Both sides share the same team and captain
  insert into public.match_sides(match_id, side, team_id, captain_id) values
    (v_match, 'A', p_team_id, v_user),
    (v_match, 'B', p_team_id, v_user);

  -- Roster split
  foreach v_uid in array p_side_a_user_ids loop
    insert into public.match_participants(match_id, user_id, side, invitation_status, attendance)
      values (v_match, v_uid, 'A', 'accepted', null);
  end loop;
  foreach v_uid in array p_side_b_user_ids loop
    insert into public.match_participants(match_id, user_id, side, invitation_status, attendance)
      values (v_match, v_uid, 'B', 'accepted', null);
  end loop;

  return v_match;
end;
$$;

revoke all on function public.create_internal_match(uuid, timestamptz, text, boolean, text, text, text, uuid[], uuid[]) from public, anon;
grant execute on function public.create_internal_match(uuid, timestamptz, text, boolean, text, text, text, uuid[], uuid[]) to authenticated;


-- ============================ submit_internal_match_result =================
-- Em jogos internos só há um capitão (mesmo de ambos os lados) — submete o
-- resultado de uma vez e o match é validado imediatamente.
create or replace function public.submit_internal_match_result(
  p_match_id     uuid,
  p_score_a      int,
  p_score_b      int,
  p_participants jsonb  -- [{user_id, attended, goals, assists, side: 'A'|'B'}]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_status   match_status;
  v_internal boolean;
  v_row      jsonb;
  v_uid      uuid;
  v_attended boolean;
  v_goals    int;
  v_assists  int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_score_a < 0 or p_score_b < 0 then
    raise exception 'Scores must be non-negative';
  end if;

  select status, is_internal into v_status, v_internal
    from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if not coalesce(v_internal, false) then
    raise exception 'This match is not internal';
  end if;
  if v_status not in ('confirmed', 'result_pending', 'disputed') then
    raise exception 'Match not ready for results';
  end if;

  -- captain check (same captain on both sides)
  if not exists (
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) then
    raise exception 'Only the captain can submit';
  end if;

  -- Reset all attendance to missed
  update public.match_participants
    set attendance = 'missed', goals = 0, assists = 0, responded_at = now()
    where match_id = p_match_id;

  if p_participants is not null then
    for v_row in select * from jsonb_array_elements(p_participants) loop
      v_uid      := (v_row->>'user_id')::uuid;
      v_attended := coalesce((v_row->>'attended')::boolean, true);
      v_goals    := greatest(0, coalesce((v_row->>'goals')::int, 0));
      v_assists  := greatest(0, coalesce((v_row->>'assists')::int, 0));

      update public.match_participants
        set attendance = case when v_attended then 'attended'::attendance else 'missed'::attendance end,
            goals = v_goals, assists = v_assists, responded_at = now()
        where match_id = p_match_id and user_id = v_uid;
    end loop;
  end if;

  -- Validate the match immediately
  update public.matches
    set status        = 'validated',
        final_score_a = p_score_a,
        final_score_b = p_score_b,
        validated_at  = now()
    where id = p_match_id;
end;
$$;

revoke all on function public.submit_internal_match_result(uuid, int, int, jsonb) from public, anon;
grant execute on function public.submit_internal_match_result(uuid, int, int, jsonb) to authenticated;


-- =============================================================================
-- Skip ELO recompute for internal matches.
-- =============================================================================
-- The validation trigger fires on UPDATE; we now early-return when is_internal.
create or replace function public.tg_match_validated()
returns trigger language plpgsql as $$
begin
  if new.status = 'validated' and (old.status is distinct from 'validated') then
    new.validated_at := coalesce(new.validated_at, now());
    if not coalesce(new.is_internal, false) then
      perform public.calculate_match_elo(new.id);
    end if;
  end if;
  return new;
end; $$;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0032_self_ratings.sql
-- ──────────────────────────────────────────────────────────────────────────

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
