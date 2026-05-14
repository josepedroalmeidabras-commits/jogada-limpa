-- =============================================================================
-- UNLIMITED SUB-CAPTAINS
-- =============================================================================
-- Substitui os 2 slots fixos (teams.sub_captain_1_id / _2_id) por uma tabela
-- team_sub_captains sem limite de entradas. Capitão pode promover quantos
-- sub-capitães quiser.

create table if not exists public.team_sub_captains (
  team_id  uuid not null references public.teams(id)    on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (team_id, user_id)
);

create index if not exists idx_tsc_user on public.team_sub_captains(user_id);

alter table public.team_sub_captains enable row level security;

create policy "tsc_read_all"
  on public.team_sub_captains for select to authenticated, anon
  using (true);


-- Migrate existing data from the 2 column slots
insert into public.team_sub_captains (team_id, user_id)
select id, sub_captain_1_id from public.teams where sub_captain_1_id is not null
on conflict do nothing;

insert into public.team_sub_captains (team_id, user_id)
select id, sub_captain_2_id from public.teams where sub_captain_2_id is not null
on conflict do nothing;


-- Update is_team_leader to use the new table
create or replace function public.is_team_leader(
  p_team_id uuid,
  p_user_id uuid
) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.teams t
      where t.id = p_team_id and t.captain_id = p_user_id
    )
    or exists (
      select 1 from public.team_sub_captains s
      where s.team_id = p_team_id and s.user_id = p_user_id
    );
$$;

revoke all on function public.is_team_leader(uuid, uuid) from public, anon;
grant execute on function public.is_team_leader(uuid, uuid) to authenticated;


-- Drop the old 2-slot RPC and replace with add/remove pair
drop function if exists public.set_team_sub_captains(uuid, uuid, uuid);

create or replace function public.add_team_sub_captain(
  p_team_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_team from public.teams where id = p_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;
  if v_team.captain_id <> v_user then
    raise exception 'Only the captain can add sub-captains';
  end if;

  if p_user_id = v_team.captain_id then
    raise exception 'Sub-captain cannot be the captain';
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_user_id
  ) then
    raise exception 'User is not a team member';
  end if;

  insert into public.team_sub_captains (team_id, user_id)
  values (p_team_id, p_user_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.add_team_sub_captain(uuid, uuid) from public, anon;
grant execute on function public.add_team_sub_captain(uuid, uuid) to authenticated;


create or replace function public.remove_team_sub_captain(
  p_team_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_team from public.teams where id = p_team_id;
  if not found then raise exception 'Team not found'; end if;
  if v_team.captain_id <> v_user then
    raise exception 'Only the captain can remove sub-captains';
  end if;

  delete from public.team_sub_captains
  where team_id = p_team_id and user_id = p_user_id;
end;
$$;

revoke all on function public.remove_team_sub_captain(uuid, uuid) from public, anon;
grant execute on function public.remove_team_sub_captain(uuid, uuid) to authenticated;


-- Drop the legacy columns now that nothing else uses them
drop index if exists idx_teams_sub1;
drop index if exists idx_teams_sub2;
alter table public.teams drop column if exists sub_captain_1_id;
alter table public.teams drop column if exists sub_captain_2_id;
