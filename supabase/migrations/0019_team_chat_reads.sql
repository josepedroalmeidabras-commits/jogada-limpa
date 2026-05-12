-- =============================================================================
-- TEAM CHAT READ RECEIPTS
-- =============================================================================
-- Per-user marker of the last time they opened a team's chat. Lets us derive
-- an unread count by comparing against team_messages.created_at.

create table if not exists public.team_chat_reads (
  team_id      uuid not null references public.teams(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.team_chat_reads enable row level security;

create policy "team_chat_reads_select_own"
  on public.team_chat_reads for select
  using (auth.uid() = user_id);

create policy "team_chat_reads_upsert_own"
  on public.team_chat_reads for insert
  with check (auth.uid() = user_id);

create policy "team_chat_reads_update_own"
  on public.team_chat_reads for update
  using (auth.uid() = user_id);


-- helper: bump my last_read_at for a team
create or replace function public.mark_team_chat_read(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- must be member of team
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = v_user
  ) then
    raise exception 'Not a member of this team';
  end if;

  insert into public.team_chat_reads(team_id, user_id, last_read_at)
  values (p_team_id, v_user, now())
  on conflict (team_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_team_chat_read(uuid) from public, anon;
grant execute on function public.mark_team_chat_read(uuid) to authenticated;
