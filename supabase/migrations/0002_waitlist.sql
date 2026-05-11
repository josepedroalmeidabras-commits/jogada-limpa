-- =============================================================================
-- Waitlist — recolha de emails da landing page antes do lançamento
-- =============================================================================

create table public.waitlist (
  id          uuid primary key default uuid_generate_v4(),
  email       text unique not null,
  city        text default 'Coimbra',
  source      text default 'landing',
  created_at  timestamptz default now(),
  constraint chk_email_format
    check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

create index idx_waitlist_created on public.waitlist(created_at desc);

alter table public.waitlist enable row level security;

-- Qualquer pessoa pode inscrever-se
create policy "waitlist_insert"
  on public.waitlist
  for insert
  with check (true);

-- Ninguém pode ler via API anon (admin lê na consola Supabase com service_role)
-- (sem policy de SELECT → tudo bloqueado por defeito com RLS on)
