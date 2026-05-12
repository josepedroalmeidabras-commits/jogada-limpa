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
