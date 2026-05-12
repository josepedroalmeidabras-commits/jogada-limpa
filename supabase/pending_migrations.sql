-- =============================================================================
-- Jogada Limpa — Migrations PENDENTES (0033 + 0034)
-- =============================================================================
-- 0033 — profiles.jersey_number + nickname + preferred_foot
-- 0034 — player_stat_category gains 5 GK values
-- =============================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0033_profile_personalisation.sql
-- ──────────────────────────────────────────────────────────────────────────

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


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0034_goalkeeper_stats.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- GOALKEEPER STATS
-- =============================================================================
-- Adiciona 5 valores novos ao enum `player_stat_category` para guarda-redes.
-- Outfielders continuam com os 6 valores existentes (velocidade, remate,
-- drible, passe, defesa, físico). GKs usam o set:
--   reflexos · defesa_aerea · posicionamento · distribuicao · saidas · fisico
--
-- Ambos partilham `fisico`. A diferenciação é client-side: o componente
-- PlayerStatsCard escolhe quais 6 mostrar consoante `preferred_position`.

alter type public.player_stat_category add value if not exists 'reflexos';
alter type public.player_stat_category add value if not exists 'defesa_aerea';
alter type public.player_stat_category add value if not exists 'posicionamento';
alter type public.player_stat_category add value if not exists 'distribuicao';
alter type public.player_stat_category add value if not exists 'saidas';
