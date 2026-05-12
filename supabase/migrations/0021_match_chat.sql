-- =============================================================================
-- MATCH CHAT — shared chat across both teams of a match
-- =============================================================================
-- Auto-exists for every match. Any member of either participating team can
-- read and write. Captains of either team (or message author) can delete.

create table if not exists public.match_messages (
  id         uuid primary key default uuid_generate_v4(),
  match_id   uuid not null references public.matches(id)   on delete cascade,
  author_id  uuid not null references public.profiles(id)  on delete cascade,
  text       text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz default now()
);

create index if not exists idx_match_messages_match_created
  on public.match_messages(match_id, created_at desc);

alter table public.match_messages enable row level security;

-- A member of either team can read.
create policy "match_msg_read"
  on public.match_messages for select to authenticated
  using (
    exists (
      select 1
      from public.match_sides ms
      join public.team_members tm on tm.team_id = ms.team_id
      where ms.match_id = match_messages.match_id
        and tm.user_id = auth.uid()
    )
  );

-- A member of either team can write (as themselves).
create policy "match_msg_insert"
  on public.match_messages for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1
      from public.match_sides ms
      join public.team_members tm on tm.team_id = ms.team_id
      where ms.match_id = match_messages.match_id
        and tm.user_id = auth.uid()
    )
  );

-- Author or either captain of the match can delete.
create policy "match_msg_delete"
  on public.match_messages for delete to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1
      from public.match_sides ms
      where ms.match_id = match_messages.match_id
        and ms.captain_id = auth.uid()
    )
  );

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_messages'
  ) then
    alter publication supabase_realtime add table public.match_messages;
  end if;
end $$;


-- ============================ match_chat_reads =============================
-- Per-user marker of the last time they opened a match's chat.

create table if not exists public.match_chat_reads (
  match_id     uuid not null references public.matches(id)   on delete cascade,
  user_id      uuid not null references public.profiles(id)  on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.match_chat_reads enable row level security;

create policy "match_chat_reads_select_own"
  on public.match_chat_reads for select
  using (auth.uid() = user_id);

create policy "match_chat_reads_upsert_own"
  on public.match_chat_reads for insert
  with check (auth.uid() = user_id);

create policy "match_chat_reads_update_own"
  on public.match_chat_reads for update
  using (auth.uid() = user_id);


create or replace function public.mark_match_chat_read(p_match_id uuid)
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

  -- must be a member of one of the teams
  if not exists (
    select 1
    from public.match_sides ms
    join public.team_members tm on tm.team_id = ms.team_id
    where ms.match_id = p_match_id and tm.user_id = v_user
  ) then
    raise exception 'Not a participant of this match';
  end if;

  insert into public.match_chat_reads(match_id, user_id, last_read_at)
  values (p_match_id, v_user, now())
  on conflict (match_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_match_chat_read(uuid) from public, anon;
grant execute on function public.mark_match_chat_read(uuid) to authenticated;
