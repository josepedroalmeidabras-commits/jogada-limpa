-- =============================================================================
-- 0073 — Self-report de golos/assists por jogador (validação pelo capitão)
-- =============================================================================
-- Cada participante pode auto-reportar quantos golos e assists fez no jogo.
-- O capitão (ou sub-capitão) vê estes valores pré-preenchidos no ecrã de
-- result submission e pode validar/ajustar antes de submeter — poupa o
-- trabalho de andar a perguntar quem marcou.

alter table public.match_participants
  add column if not exists self_reported_goals   int,
  add column if not exists self_reported_assists int,
  add column if not exists self_reported_at      timestamptz;

create or replace function public.submit_match_self_report(
  p_match_id uuid,
  p_goals    int,
  p_assists  int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_status text;
begin
  if v_me is null then raise exception 'Sem sessão'; end if;
  if p_goals < 0 or p_assists < 0 then
    raise exception 'Valores inválidos';
  end if;
  if p_goals > 20 or p_assists > 20 then
    raise exception 'Valor demasiado alto';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if v_status is null then raise exception 'Jogo não existe'; end if;
  if v_status not in ('confirmed', 'result_pending') then
    raise exception 'Só podes reportar antes do jogo ser validado';
  end if;

  update public.match_participants
  set self_reported_goals   = p_goals,
      self_reported_assists = p_assists,
      self_reported_at      = now()
  where match_id = p_match_id
    and user_id = v_me;

  if not found then
    raise exception 'Não participaste neste jogo';
  end if;
end;
$$;

grant execute on function public.submit_match_self_report(uuid, int, int) to authenticated;
