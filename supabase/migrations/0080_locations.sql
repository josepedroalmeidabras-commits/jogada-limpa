-- =============================================================================
-- 0080 — Locations table (campos pré-definidos por cidade)
-- =============================================================================
-- Quando alguém marca um jogo, em vez de escrever o nome livremente escolhe
-- de uma lista de localizações na cidade. Mantém-se a opção "Outro" para
-- escrever manualmente. Seed inicial com 4 sítios em Coimbra.

create table if not exists public.locations (
  id          uuid primary key default uuid_generate_v4(),
  city        text not null,
  name        text not null,
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz default now()
);

create index if not exists idx_locations_city on public.locations(city) where is_active;

alter table public.locations enable row level security;

create policy "locations_read_all"
  on public.locations for select
  using (true);

-- Seed Coimbra
insert into public.locations (city, name, address) values
  ('Coimbra', 'Estádio Cidade Universitária', 'R. Alfredo Magalhães Ramalho, 3000'),
  ('Coimbra', 'Campo Municipal de Celas', 'R. de Aveiro 47, Coimbra'),
  ('Coimbra', 'Pavilhão Olivais Athletic', 'R. dos Combatentes da Grande Guerra, Coimbra'),
  ('Coimbra', 'Campo do Calhabé', 'R. António Sérgio, Solum, Coimbra')
on conflict do nothing;
