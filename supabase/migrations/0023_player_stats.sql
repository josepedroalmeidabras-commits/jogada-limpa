-- =============================================================================
-- PES-STYLE PLAYER STATS — voted by teammates + self
-- =============================================================================
-- Each player has 6 attributes (1-99). Anyone can suggest values for themselves;
-- current teammates can also vote. Display = average of all votes for that user
-- in that category. Each (voter, target, category) is a single upsertable vote.

create type player_stat_category as enum (
  'velocidade',
  'remate',
  'drible',
  'passe',
  'defesa',
  'fisico'
);

create table public.player_stat_votes (
  voter_id   uuid not null references public.profiles(id) on delete cascade,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  category   player_stat_category not null,
  value      smallint not null check (value between 1 and 99),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (voter_id, target_id, category)
);

create index idx_psv_target on public.player_stat_votes(target_id, category);
create index idx_psv_voter  on public.player_stat_votes(voter_id);

alter table public.player_stat_votes enable row level security;

-- Read your own votes (so the UI can pre-fill sliders) or votes about you
create policy "psv_read_own"
  on public.player_stat_votes for select
  using (auth.uid() = voter_id or auth.uid() = target_id);

-- Aggregated view: average across all votes for each (user, category)
create or replace view public.player_stats_aggregate as
select
  target_id                            as user_id,
  category::text                       as category,
  round(avg(value)::numeric, 0)::int   as value,
  count(*)::int                        as votes
from public.player_stat_votes
group by target_id, category;

grant select on public.player_stats_aggregate to authenticated, anon;


-- ============================ set_my_stat_vote =============================
-- Upsert your vote for someone. Self-rating always allowed. Otherwise you must
-- currently be on a team with the target (any current team).
create or replace function public.set_my_stat_vote(
  p_target_id uuid,
  p_category  text,
  p_value     smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_eligible  boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_value < 1 or p_value > 99 then
    raise exception 'Value must be between 1 and 99';
  end if;

  if v_user = p_target_id then
    v_eligible := true;
  else
    select exists(
      select 1
      from public.team_members tm1
      join public.team_members tm2 on tm1.team_id = tm2.team_id
      join public.teams t          on t.id = tm1.team_id and t.is_active
      where tm1.user_id = v_user
        and tm2.user_id = p_target_id
    ) into v_eligible;
  end if;

  if not v_eligible then
    raise exception 'Only teammates can vote on this player';
  end if;

  insert into public.player_stat_votes(voter_id, target_id, category, value)
  values (v_user, p_target_id, p_category::player_stat_category, p_value)
  on conflict (voter_id, target_id, category)
  do update set
    value      = excluded.value,
    updated_at = now();
end;
$$;

revoke all on function public.set_my_stat_vote(uuid, text, smallint) from public, anon;
grant execute on function public.set_my_stat_vote(uuid, text, smallint) to authenticated;


-- ============================ can_vote_on_player ===========================
-- Boolean helper so the UI knows whether to show the "Votar" button.
create or replace function public.can_vote_on_player(p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  if v_user = p_target_id then return true; end if;

  return exists(
    select 1
    from public.team_members tm1
    join public.team_members tm2 on tm1.team_id = tm2.team_id
    join public.teams t          on t.id = tm1.team_id and t.is_active
    where tm1.user_id = v_user
      and tm2.user_id = p_target_id
  );
end;
$$;

revoke all on function public.can_vote_on_player(uuid) from public, anon;
grant execute on function public.can_vote_on_player(uuid) to authenticated;
