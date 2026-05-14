-- =============================================================================
-- 0070 — renomear desporto "Futebol 7" para "S7VN"
-- =============================================================================
-- Decisão de branding: app é F7-only e o nome do desporto passa a ser o nome
-- da marca. O `code` mantém-se 'futebol7' (identificador interno).

update public.sports set name = 'S7VN' where code = 'futebol7';
