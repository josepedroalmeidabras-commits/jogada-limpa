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
