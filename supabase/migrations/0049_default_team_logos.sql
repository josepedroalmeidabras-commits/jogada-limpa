-- =============================================================================
-- DEFAULT TEAM LOGOS via DiceBear
-- =============================================================================
-- Garante que toda a equipa tem um logo gerado por defeito (placeholder
-- abstrato com cor de fundo da brand). Quem quiser substituir pode fazer
-- upload do escudo real — o photo_url só recebe o default quando é null.

create or replace function public.set_default_team_logo()
returns trigger
language plpgsql
as $$
begin
  if new.photo_url is null or trim(new.photo_url) = '' then
    new.photo_url := 'https://api.dicebear.com/9.x/shapes/png?seed='
                  || new.id::text
                  || '&backgroundColor=0E1812'
                  || '&shape1Color=C9A26B'
                  || '&shape2Color=B58E55'
                  || '&shape3Color=ffffff';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_default_team_logo on public.teams;
create trigger trg_default_team_logo
  before insert on public.teams
  for each row
  execute function public.set_default_team_logo();

-- Backfill: aplicar default a todas as equipas existentes sem logo.
update public.teams
   set photo_url = 'https://api.dicebear.com/9.x/shapes/png?seed='
                || id::text
                || '&backgroundColor=0E1812'
                || '&shape1Color=C9A26B'
                || '&shape2Color=B58E55'
                || '&shape3Color=ffffff'
 where photo_url is null or trim(photo_url) = '';
