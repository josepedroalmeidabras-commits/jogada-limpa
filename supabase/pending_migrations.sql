-- =============================================================================
-- Jogada Limpa — Migrations PENDENTES (0027 + 0028)
-- =============================================================================
-- Estado em 2026-05-12: corridas 0001-0026.
-- Pendentes:
--   0027 — open_match_requests (desafios abertos)
--   0028 — team_head_to_head + suggested_opponents RPCs
-- =============================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0027_open_match_requests.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- OPEN MATCH REQUESTS
-- =============================================================================
-- A captain posts "looking for opponent" without naming a specific opponent.
-- Any captain of a same-sport team in the same city can claim it, which
-- converts the request into a confirmed match (skipping the propose/accept dance).

create table if not exists public.open_match_requests (
  id              uuid primary key default uuid_generate_v4(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  sport_id        int not null references public.sports(id),
  city            text not null,
  scheduled_at    timestamptz not null,
  location_name   text,
  location_tbd    boolean default false,
  notes           text,
  min_elo         int,
  max_elo         int,
  status          text not null default 'open'
                    check (status in ('open','matched','cancelled')),
  matched_team_id uuid references public.teams(id),
  match_id        uuid references public.matches(id),
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz default now(),
  matched_at      timestamptz,
  cancelled_at    timestamptz
);

create index if not exists idx_omr_status_city
  on public.open_match_requests(status, city, scheduled_at);
create index if not exists idx_omr_team on public.open_match_requests(team_id);

alter table public.open_match_requests enable row level security;

-- Anyone authenticated can read open requests (matchmaking is public).
create policy "omr_read_all"
  on public.open_match_requests for select to authenticated
  using (true);


-- ============================ post_open_match_request ======================
create or replace function public.post_open_match_request(
  p_team_id       uuid,
  p_scheduled_at  timestamptz,
  p_location_name text default null,
  p_location_tbd  boolean default false,
  p_notes         text default null,
  p_min_elo       int default null,
  p_max_elo       int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team record;
  v_id   uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_scheduled_at <= now() then
    raise exception 'Scheduled date must be in the future';
  end if;

  select * into v_team from public.teams where id = p_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;
  if v_team.captain_id <> v_user then
    raise exception 'Only the team captain can post';
  end if;

  insert into public.open_match_requests(
    team_id, sport_id, city, scheduled_at,
    location_name, location_tbd, notes,
    min_elo, max_elo, created_by
  )
  values (
    p_team_id, v_team.sport_id, v_team.city, p_scheduled_at,
    p_location_name, coalesce(p_location_tbd, false), p_notes,
    p_min_elo, p_max_elo, v_user
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.post_open_match_request(uuid, timestamptz, text, boolean, text, int, int) from public, anon;
grant execute on function public.post_open_match_request(uuid, timestamptz, text, boolean, text, int, int) to authenticated;


-- ============================ accept_open_match_request ====================
-- Convert the open request to a confirmed match. Caller must be captain of a
-- team in the same sport (city already filtered server-side in the listing).
create or replace function public.accept_open_match_request(
  p_request_id uuid,
  p_my_team_id uuid
)
returns uuid  -- the new match id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_req       record;
  v_my_team   record;
  v_match_id  uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_req from public.open_match_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'open' then raise exception 'Request is no longer open'; end if;
  if v_req.scheduled_at <= now() then
    raise exception 'Request has already passed';
  end if;

  select * into v_my_team from public.teams where id = p_my_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;
  if v_my_team.captain_id <> v_user then
    raise exception 'Only the team captain can accept';
  end if;
  if v_my_team.id = v_req.team_id then
    raise exception 'Cannot accept your own request';
  end if;
  if v_my_team.sport_id <> v_req.sport_id then
    raise exception 'Sport mismatch';
  end if;

  -- Create the confirmed match directly (both captains already opted in)
  insert into public.matches(
    sport_id, scheduled_at, location_name, location_tbd,
    status, proposed_by, message, notes
  )
  values (
    v_req.sport_id,
    v_req.scheduled_at,
    v_req.location_name,
    v_req.location_tbd,
    'confirmed',
    v_req.created_by,
    null,
    v_req.notes
  )
  returning id into v_match_id;

  -- A = poster, B = acceptor
  insert into public.match_sides(match_id, side, team_id, captain_id) values
    (v_match_id, 'A', v_req.team_id,  v_req.created_by),
    (v_match_id, 'B', p_my_team_id,   v_user);

  -- Close the request
  update public.open_match_requests
     set status = 'matched',
         matched_team_id = p_my_team_id,
         match_id = v_match_id,
         matched_at = now()
   where id = p_request_id;

  -- Notify the poster
  insert into public.notifications(user_id, type, title, body, payload, channel)
  values (
    v_req.created_by,
    'open_match_accepted',
    'Desafio aceite',
    coalesce(v_my_team.name || ' aceitou o teu desafio aberto', 'Alguém aceitou o teu desafio'),
    jsonb_build_object('match_id', v_match_id::text, 'request_id', p_request_id::text),
    'in_app'
  );

  return v_match_id;
end;
$$;

revoke all on function public.accept_open_match_request(uuid, uuid) from public, anon;
grant execute on function public.accept_open_match_request(uuid, uuid) to authenticated;


-- ============================ cancel_open_match_request ====================
create or replace function public.cancel_open_match_request(p_request_id uuid)
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

  select * into v_req from public.open_match_requests where id = p_request_id;
  if not found then raise exception 'Not found'; end if;
  if v_req.status <> 'open' then return; end if;

  -- Only the poster captain (or anyone still listed as that team's captain) can cancel
  if not exists (
    select 1 from public.teams t
    where t.id = v_req.team_id and t.captain_id = v_user
  ) then
    raise exception 'Only the posting captain can cancel';
  end if;

  update public.open_match_requests
     set status = 'cancelled', cancelled_at = now()
   where id = p_request_id;
end;
$$;

revoke all on function public.cancel_open_match_request(uuid) from public, anon;
grant execute on function public.cancel_open_match_request(uuid) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0028_h2h_and_opponents.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- HEAD-TO-HEAD + SUGGESTED OPPONENTS
-- =============================================================================
-- Helpers so captains can size up an opponent before agreeing to a match, and
-- discover similar-level teams in their city to challenge.

-- ============================ team_head_to_head ============================
-- Returns aggregated record between two teams across validated matches.
create or replace function public.team_head_to_head(
  p_team_a uuid,
  p_team_b uuid
)
returns table (
  played      int,
  a_wins      int,
  b_wins      int,
  draws       int,
  a_goals     int,
  b_goals     int,
  last_played timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    with matched as (
      select m.id, m.scheduled_at, m.final_score_a, m.final_score_b,
             max(case when ms.side = 'A' then ms.team_id end) as side_a_team,
             max(case when ms.side = 'B' then ms.team_id end) as side_b_team
      from public.matches m
      join public.match_sides ms on ms.match_id = m.id
      where m.status = 'validated'
        and m.final_score_a is not null
        and m.final_score_b is not null
      group by m.id, m.scheduled_at, m.final_score_a, m.final_score_b
      having
        (max(case when ms.side = 'A' then ms.team_id end) = p_team_a
         and max(case when ms.side = 'B' then ms.team_id end) = p_team_b)
        or
        (max(case when ms.side = 'A' then ms.team_id end) = p_team_b
         and max(case when ms.side = 'B' then ms.team_id end) = p_team_a)
    ),
    normalised as (
      select
        scheduled_at,
        case when side_a_team = p_team_a then final_score_a else final_score_b end as a_score,
        case when side_a_team = p_team_a then final_score_b else final_score_a end as b_score
      from matched
    )
    select
      count(*)::int as played,
      sum(case when a_score > b_score then 1 else 0 end)::int as a_wins,
      sum(case when a_score < b_score then 1 else 0 end)::int as b_wins,
      sum(case when a_score = b_score then 1 else 0 end)::int as draws,
      coalesce(sum(a_score), 0)::int as a_goals,
      coalesce(sum(b_score), 0)::int as b_goals,
      max(scheduled_at) as last_played
    from normalised;
end;
$$;

revoke all on function public.team_head_to_head(uuid, uuid) from public, anon;
grant execute on function public.team_head_to_head(uuid, uuid) to authenticated;


-- ============================ suggested_opponents ==========================
-- Same sport + same city + active + not me, ordered by ELO closeness, with
-- "matches_against_me" count so the UI can hint at familiarity.
create or replace function public.suggested_opponents(
  p_my_team_id uuid,
  p_limit      int default 5
)
returns table (
  team_id      uuid,
  name         text,
  photo_url    text,
  elo_avg      numeric,
  member_count int,
  elo_diff     numeric,
  played_us    int
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
  v_me   record;
  v_my_elo numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_me from public.teams where id = p_my_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;

  select elo_avg into v_my_elo from public.team_elo where team_id = p_my_team_id;
  v_my_elo := coalesce(v_my_elo, 1200);

  return query
    with my_matches as (
      select match_id
      from public.match_sides
      where team_id = p_my_team_id
    ),
    head_count as (
      select ms.team_id as opp, count(*)::int as cnt
      from public.match_sides ms
      where ms.match_id in (select match_id from my_matches)
        and ms.team_id <> p_my_team_id
      group by ms.team_id
    ),
    candidates as (
      select t.id as team_id, t.name, t.photo_url,
             coalesce(te.elo_avg, 1200) as elo_avg,
             coalesce(te.member_count, 0) as member_count
      from public.teams t
      left join public.team_elo te on te.team_id = t.id
      where t.is_active
        and t.id <> p_my_team_id
        and t.sport_id = v_me.sport_id
        and t.city = v_me.city
    )
    select c.team_id, c.name, c.photo_url, c.elo_avg, c.member_count,
           abs(c.elo_avg - v_my_elo) as elo_diff,
           coalesce(hc.cnt, 0) as played_us
    from candidates c
    left join head_count hc on hc.opp = c.team_id
    order by elo_diff asc, c.elo_avg desc
    limit p_limit;
end;
$$;

revoke all on function public.suggested_opponents(uuid, int) from public, anon;
grant execute on function public.suggested_opponents(uuid, int) to authenticated;
