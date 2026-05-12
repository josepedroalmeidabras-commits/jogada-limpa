-- =============================================================================
-- Chat por equipa — só membros leem/escrevem; tempo real via supabase_realtime
-- =============================================================================

create table public.team_messages (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references public.teams(id)    on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz default now()
);

create index idx_team_messages_team_created
  on public.team_messages(team_id, created_at desc);

alter table public.team_messages enable row level security;

-- Membros lêem
create policy "team_msg_read"
  on public.team_messages for select to authenticated
  using (
    exists (
      select 1 from public.team_members
      where team_id = team_messages.team_id and user_id = auth.uid()
    )
  );

-- Membros escrevem
create policy "team_msg_insert"
  on public.team_messages for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.team_members
      where team_id = team_messages.team_id and user_id = auth.uid()
    )
  );

-- Autor ou capitão da equipa pode apagar
create policy "team_msg_delete"
  on public.team_messages for delete to authenticated
  using (
    auth.uid() = author_id
    or auth.uid() = (select captain_id from public.teams where id = team_messages.team_id)
  );

-- Activar realtime para esta tabela
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_messages'
  ) then
    alter publication supabase_realtime add table public.team_messages;
  end if;
end $$;
