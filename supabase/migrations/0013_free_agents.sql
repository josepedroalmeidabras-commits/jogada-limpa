-- =============================================================================
-- Mercado livre — jogadores disponíveis para entrar numa equipa
-- =============================================================================
-- Diferença de is_open_to_sub:
--   * is_open_to_sub = "aceito ser convidado para um jogo pontual"
--   * is_open_to_team = "quero juntar-me a uma equipa permanente"
-- Ambos coexistem na mesma row de user_sports.

alter table public.user_sports
  add column if not exists is_open_to_team    boolean default false,
  add column if not exists open_to_team_until timestamptz;

create index if not exists idx_user_sports_open_team
  on public.user_sports(sport_id, is_open_to_team)
  where is_open_to_team;

-- =============================================================================
-- invite_free_agent: capitão adiciona free agent à sua equipa.
-- Bypass RLS via SECURITY DEFINER porque team_members tem policy
-- "tm_join" que só permite auth.uid() = user_id (o próprio).
-- =============================================================================
create or replace function public.invite_free_agent(
  p_team_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_captain  uuid := auth.uid();
  v_team     public.teams%rowtype;
begin
  if v_captain is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_team
    from public.teams
    where id = p_team_id and is_active;
  if not found then
    raise exception 'Equipa não encontrada';
  end if;

  if v_team.captain_id <> v_captain then
    raise exception 'Só o capitão pode adicionar membros';
  end if;

  -- target tem de estar disponível para este desporto
  if not exists (
    select 1 from public.user_sports us
    where us.user_id  = p_user_id
      and us.sport_id = v_team.sport_id
      and us.is_open_to_team
      and (us.open_to_team_until is null or us.open_to_team_until > now())
  ) then
    raise exception 'Este jogador não está disponível para esta equipa';
  end if;

  -- adicionar (idempotente)
  insert into public.team_members(team_id, user_id, role)
    values (p_team_id, p_user_id, 'member')
    on conflict (team_id, user_id) do nothing;

  -- entrou numa equipa → fecha a disponibilidade para esse desporto
  update public.user_sports
    set is_open_to_team    = false,
        open_to_team_until = null
    where user_id  = p_user_id
      and sport_id = v_team.sport_id;
end;
$$;

revoke all on function public.invite_free_agent(uuid, uuid)
  from public, anon;
grant execute on function public.invite_free_agent(uuid, uuid) to authenticated;
