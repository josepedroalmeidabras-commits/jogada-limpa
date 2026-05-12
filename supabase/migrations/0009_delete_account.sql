-- =============================================================================
-- Soft delete de contas (RGPD)
-- =============================================================================
-- Hard delete bate em FK constraints (matches.proposed_by NOT NULL).
-- Solução pragmática: anonimizar PII + marcar deleted_at. Reviews e jogos
-- preservados para integridade referencial, mas o nome aparece como
-- "Conta apagada" em todo o lado.

alter table public.profiles
  add column if not exists deleted_at timestamptz;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Anonimizar e marcar
  update public.profiles
    set name        = 'Conta apagada',
        photo_url   = null,
        phone       = null,
        city        = '—',
        is_active   = false,
        deleted_at  = now(),
        updated_at  = now()
    where id = v_user
      and deleted_at is null;

  -- Sair de todas as equipas onde for membro (não capitão).
  -- Capitães não saem automaticamente — devem transferir ou abandonar via suporte.
  delete from public.team_members tm
  where tm.user_id = v_user
    and tm.role = 'member';

  -- Tornar inativos sports e remover disponibilidade
  update public.user_sports
    set is_open_to_sub = false,
        open_until = null
    where user_id = v_user;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
