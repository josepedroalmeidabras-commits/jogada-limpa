-- =============================================================================
-- Pivot: foco exclusivo em Futebol de 7
-- =============================================================================
-- Decisão de produto (2026-05-12): a app passa a ser dedicada a F7. F5 e F11
-- ficam desativados (registos preservados no schema para eventual reativação,
-- mas escondidos do UI via is_active = false). Padel já estava inativo.
-- Equipas e jogos existentes em F5/F11 não são apagados — ficam dormentes.

update public.sports set is_active = false where code in ('futebol5','futebol11');

-- Sanity check: F7 deve continuar ativo.
do $$
begin
  if not exists (select 1 from public.sports where code = 'futebol7' and is_active) then
    raise exception 'futebol7 deve estar ativo após este pivot';
  end if;
end;
$$;
