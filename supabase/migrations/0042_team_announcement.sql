-- =============================================================================
-- TEAM ANNOUNCEMENT (pinned)
-- =============================================================================
-- Mensagem fixada por capitão, visível ao topo do detalhe da equipa. Diferente
-- do chat — só uma de cada vez, persistente.

alter table public.teams
  add column if not exists announcement      text,
  add column if not exists announcement_at   timestamptz;


create or replace function public.set_team_announcement(
  p_team_id uuid,
  p_text    text  -- null/empty para limpar
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team record;
  v_msg  text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_team from public.teams where id = p_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;
  if v_team.captain_id <> v_user then
    raise exception 'Only the captain can pin announcements';
  end if;

  v_msg := nullif(trim(coalesce(p_text, '')), '');
  if v_msg is not null and char_length(v_msg) > 280 then
    raise exception 'Announcement too long (max 280 chars)';
  end if;

  update public.teams
    set announcement = v_msg,
        announcement_at = case when v_msg is null then null else now() end
    where id = p_team_id;

  -- in-app notification for members on first publish or replacement (not clearing)
  if v_msg is not null then
    insert into public.notifications(user_id, type, title, body, payload, channel)
    select tm.user_id,
           'team_announcement',
           coalesce(v_team.name, 'A tua equipa') || ' fixou um aviso',
           left(v_msg, 120),
           jsonb_build_object('team_id', p_team_id::text),
           'in_app'
    from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id <> v_user;
  end if;
end;
$$;

revoke all on function public.set_team_announcement(uuid, text) from public, anon;
grant execute on function public.set_team_announcement(uuid, text) to authenticated;
