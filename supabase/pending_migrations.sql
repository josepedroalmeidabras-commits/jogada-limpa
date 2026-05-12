-- =============================================================================
-- Jogada Limpa — Migrations PENDENTES (0038 + 0039)
-- =============================================================================
-- 0038 — open_substitute_requests
-- 0039 — fetch_user_rating_history RPC
-- =============================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0038_open_substitute_requests.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- OPEN SUBSTITUTE REQUESTS
-- =============================================================================
-- Capitão de um jogo confirmado pode publicar "preciso de N jogadores" —
-- jogadores externos da mesma cidade respondem. Quando count_filled atinge
-- count_needed o pedido fecha-se sozinho.

create table if not exists public.open_substitute_requests (
  id              uuid primary key default uuid_generate_v4(),
  match_id        uuid not null references public.matches(id) on delete cascade,
  team_id         uuid not null references public.teams(id),
  side            side not null,
  position_needed text check (position_needed in ('gr','def','med','ata')),
  count_needed    int not null default 1 check (count_needed between 1 and 6),
  count_filled    int not null default 0,
  notes           text,
  city            text not null,
  status          text not null default 'open'
                    check (status in ('open','filled','cancelled')),
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz default now(),
  closed_at       timestamptz
);

create index if not exists idx_osr_status_city
  on public.open_substitute_requests(status, city);
create index if not exists idx_osr_match on public.open_substitute_requests(match_id);

alter table public.open_substitute_requests enable row level security;

create policy "osr_read_all"
  on public.open_substitute_requests for select to authenticated
  using (true);


-- ============================ post_substitute_request ======================
create or replace function public.post_substitute_request(
  p_match_id    uuid,
  p_side        text,  -- 'A' or 'B'
  p_position    text default null,
  p_count       int default 1,
  p_notes       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_match record;
  v_team  record;
  v_id    uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_side not in ('A','B') then raise exception 'Invalid side'; end if;
  if p_count is null or p_count < 1 or p_count > 6 then
    raise exception 'count must be between 1 and 6';
  end if;

  select id, status, scheduled_at, is_internal into v_match
    from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status not in ('confirmed', 'proposed') then
    raise exception 'Substitutes only for proposed/confirmed matches';
  end if;
  if v_match.scheduled_at <= now() then
    raise exception 'Match already started';
  end if;

  select t.id, t.city into v_team
    from public.match_sides ms
    join public.teams t on t.id = ms.team_id
    where ms.match_id = p_match_id
      and ms.side = p_side::side
      and ms.captain_id = v_user;
  if not found then
    raise exception 'Only the captain of that side can post';
  end if;

  insert into public.open_substitute_requests(
    match_id, team_id, side, position_needed, count_needed, notes, city, created_by
  )
  values (
    p_match_id, v_team.id, p_side::side,
    nullif(p_position, ''),
    p_count,
    nullif(trim(p_notes), ''),
    v_team.city,
    v_user
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.post_substitute_request(uuid, text, text, int, text) from public, anon;
grant execute on function public.post_substitute_request(uuid, text, text, int, text) to authenticated;


-- ============================ accept_substitute_request ====================
-- Qualquer jogador autenticado pode aceitar. Cria/actualiza match_participants
-- com invitation_status='accepted' do lado certo. Quando count_filled atinge
-- count_needed o pedido fecha automaticamente.
create or replace function public.accept_substitute_request(p_request_id uuid)
returns uuid  -- returns match_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req  record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_req from public.open_substitute_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'open' then raise exception 'Request not open'; end if;
  if v_req.count_filled >= v_req.count_needed then
    raise exception 'Already filled';
  end if;
  if v_req.created_by = v_user then
    raise exception 'Cannot accept your own request';
  end if;

  -- soft check: not already a participant
  if exists (
    select 1 from public.match_participants
    where match_id = v_req.match_id and user_id = v_user
  ) then
    raise exception 'You are already in this match';
  end if;

  -- block check (between the captain and the volunteer)
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = v_req.created_by and blocked_id = v_user)
       or (blocker_id = v_user and blocked_id = v_req.created_by)
  ) then
    raise exception 'Cannot accept this request';
  end if;

  insert into public.match_participants(match_id, user_id, side, invitation_status, attendance)
  values (v_req.match_id, v_user, v_req.side, 'accepted', null);

  update public.open_substitute_requests
    set count_filled = count_filled + 1,
        status = case when count_filled + 1 >= count_needed then 'filled' else status end,
        closed_at = case when count_filled + 1 >= count_needed then now() else closed_at end
    where id = p_request_id;

  -- Notify the captain
  insert into public.notifications(user_id, type, title, body, payload, channel)
  values (
    v_req.created_by,
    'substitute_accepted',
    'Substituto encontrado',
    'Alguém aceitou o teu pedido de substituto.',
    jsonb_build_object(
      'match_id', v_req.match_id::text,
      'request_id', p_request_id::text,
      'volunteer_id', v_user::text
    ),
    'in_app'
  );

  return v_req.match_id;
end;
$$;

revoke all on function public.accept_substitute_request(uuid) from public, anon;
grant execute on function public.accept_substitute_request(uuid) to authenticated;


-- ============================ cancel_substitute_request ====================
create or replace function public.cancel_substitute_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req  record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_req from public.open_substitute_requests where id = p_request_id;
  if not found then raise exception 'Not found'; end if;
  if v_req.created_by <> v_user then
    raise exception 'Only the creator can cancel';
  end if;
  if v_req.status <> 'open' then return; end if;

  update public.open_substitute_requests
    set status = 'cancelled', closed_at = now()
    where id = p_request_id;
end;
$$;

revoke all on function public.cancel_substitute_request(uuid) from public, anon;
grant execute on function public.cancel_substitute_request(uuid) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0039_rating_history.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- RATING HISTORY per match
-- =============================================================================
-- Para o gráfico de evolução de prestação. Para cada jogo validado em que o
-- user participou, devolve a média das reviews que recebeu (1-5).
--
-- Anonimato: para não revelar o rating individual quando há só 1 review,
-- pedimos count(*) >= 2 quando o caller não é o próprio user.

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
      select mp.match_id, mp.side
      from public.match_participants mp
      where mp.user_id = p_user_id
        and mp.attendance in ('attended','substitute_in')
    ),
    rated as (
      select
        r.match_id,
        round((avg(r.fair_play) + avg(r.punctuality)
             + avg(r.technical_level) + avg(r.attitude)) / 4.0::numeric, 1) as avg_rating,
        count(*)::int as review_count
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
      rd.avg_rating,
      rd.review_count
    from my_rows mr
    join rated rd on rd.match_id = mr.match_id
    join public.matches m on m.id = mr.match_id
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
