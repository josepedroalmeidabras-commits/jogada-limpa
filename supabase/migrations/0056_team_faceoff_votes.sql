-- =============================================================================
-- TEAM FACE-OFF VOTES
-- =============================================================================
-- Membros de uma equipa podem votar "quem é melhor" entre dois colegas. Cada
-- voter tem um voto por par (canonical low/high). Pode mudar o voto.

create table if not exists public.team_faceoff_votes (
  team_id     uuid not null references public.teams(id)    on delete cascade,
  voter_id    uuid not null references public.profiles(id) on delete cascade,
  player_low  uuid not null references public.profiles(id) on delete cascade,
  player_high uuid not null references public.profiles(id) on delete cascade,
  winner_id   uuid          references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  primary key (team_id, voter_id, player_low, player_high),
  check (player_low < player_high),
  check (winner_id is null or winner_id in (player_low, player_high))
);

create index if not exists idx_faceoff_pair
  on public.team_faceoff_votes (team_id, player_low, player_high);

alter table public.team_faceoff_votes enable row level security;

create policy "faceoff_read_team_member"
  on public.team_faceoff_votes for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_faceoff_votes.team_id
        and tm.user_id = auth.uid()
    )
  );


-- ============================ cast_faceoff_vote ============================
-- Vote winner_id = one of the two players, or NULL para empate.
create or replace function public.cast_faceoff_vote(
  p_team_id   uuid,
  p_player_a  uuid,
  p_player_b  uuid,
  p_winner_id uuid  -- null = empate
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_low  uuid;
  v_high uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_player_a is null or p_player_b is null then
    raise exception 'Players required';
  end if;
  if p_player_a = p_player_b then
    raise exception 'Players must be different';
  end if;
  if p_winner_id is not null
     and p_winner_id <> p_player_a
     and p_winner_id <> p_player_b then
    raise exception 'Winner must be one of the two players';
  end if;

  -- voter must be a member of the team
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = v_user
  ) then
    raise exception 'Only team members can vote';
  end if;
  -- both players must be members of the team
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_player_a
  ) then raise exception 'Player A is not in this team'; end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_player_b
  ) then raise exception 'Player B is not in this team'; end if;

  if p_player_a < p_player_b then
    v_low := p_player_a; v_high := p_player_b;
  else
    v_low := p_player_b; v_high := p_player_a;
  end if;

  insert into public.team_faceoff_votes (
    team_id, voter_id, player_low, player_high, winner_id
  ) values (
    p_team_id, v_user, v_low, v_high, p_winner_id
  )
  on conflict (team_id, voter_id, player_low, player_high) do update set
    winner_id  = excluded.winner_id,
    updated_at = now();
end;
$$;

revoke all on function public.cast_faceoff_vote(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.cast_faceoff_vote(uuid, uuid, uuid, uuid) to authenticated;


-- ============================ fetch_faceoff_tally =========================
create or replace function public.fetch_faceoff_tally(
  p_team_id  uuid,
  p_player_a uuid,
  p_player_b uuid
) returns table (
  votes_for_a int,
  votes_for_b int,
  draws       int,
  my_vote     text  -- 'a' | 'b' | 'draw' | null
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
  v_low  uuid;
  v_high uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_player_a < p_player_b then
    v_low := p_player_a; v_high := p_player_b;
  else
    v_low := p_player_b; v_high := p_player_a;
  end if;

  return query
    with votes as (
      select winner_id, voter_id
      from public.team_faceoff_votes
      where team_id = p_team_id
        and player_low = v_low
        and player_high = v_high
    ),
    counts as (
      select
        count(*) filter (where winner_id = p_player_a)::int as a,
        count(*) filter (where winner_id = p_player_b)::int as b,
        count(*) filter (where winner_id is null)::int      as d,
        max(case when voter_id = v_user then
          case
            when winner_id = p_player_a then 'a'
            when winner_id = p_player_b then 'b'
            else 'draw'
          end
        end) as mine
      from votes
    )
    select a, b, d, mine from counts;
end;
$$;

revoke all on function public.fetch_faceoff_tally(uuid, uuid, uuid) from public, anon;
grant execute on function public.fetch_faceoff_tally(uuid, uuid, uuid) to authenticated;
