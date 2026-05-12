-- =============================================================================
-- Push tokens (Expo) — uma linha por dispositivo de um user
-- =============================================================================
-- Token é único globalmente (vem do Expo). Se o mesmo dispositivo fizer
-- login com user diferente, a UPSERT atualiza o user_id.

create table public.push_tokens (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique,
  platform   text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_push_tokens_user on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- O dono escreve só os seus tokens
create policy "push_tokens_own_insert"
  on public.push_tokens for insert to authenticated
  with check (auth.uid() = user_id);

create policy "push_tokens_own_update"
  on public.push_tokens for update to authenticated
  using (auth.uid() = user_id);

create policy "push_tokens_own_delete"
  on public.push_tokens for delete to authenticated
  using (auth.uid() = user_id);

-- Qualquer authenticated user pode ler tokens (necessário para enviar push
-- de um user a outro a partir do cliente). Tokens Expo são quasi-públicos
-- por design — não dão acesso a dados, só a entregar pushes.
create policy "push_tokens_read"
  on public.push_tokens for select to authenticated
  using (true);
