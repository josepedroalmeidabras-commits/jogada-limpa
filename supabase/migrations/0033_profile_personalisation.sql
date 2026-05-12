-- =============================================================================
-- PROFILE PERSONALISATION
-- =============================================================================
-- Adiciona campos opcionais que dão personalidade ao perfil sem inflar schema:
--   jersey_number  — número de camisola 1-99
--   nickname       — alcunha de campo (≤ 20 chars), aparece em "João «Bombas» Marques"
--   preferred_foot — pé preferido (left, right, both)

alter table public.profiles
  add column if not exists jersey_number  smallint check (jersey_number between 1 and 99),
  add column if not exists nickname       text     check (char_length(nickname) <= 20),
  add column if not exists preferred_foot text     check (preferred_foot in ('left','right','both'));
