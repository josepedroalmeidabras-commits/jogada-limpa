-- =============================================================================
-- Jogada Limpa — Migrations PENDENTES (0041 + 0042)
-- =============================================================================
-- 0041 — fetch_team_top_contributors
-- 0042 — teams.announcement + set_team_announcement RPC
-- =============================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0041_team_stats.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- TEAM CONTRIBUTORS — top goleador + top assistente por equipa
-- =============================================================================
-- Agrega golos e assistências dos membros nos jogos validados onde foram do
-- lado da equipa.

create or replace function public.fetch_team_top_contributors(
  p_team_id uuid,
  p_limit   int default 10
)
returns table (
  user_id      uuid,
  name         text,
  photo_url    text,
  goals        int,
  assists      int,
  matches      int,
  goal_share   numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_total_goals int;
begin
  select coalesce(sum(case
                   when ms.team_id = p_team_id and ms.side = 'A' then m.final_score_a
                   when ms.team_id = p_team_id and ms.side = 'B' then m.final_score_b
                   else 0 end), 0)
    into v_total_goals
    from public.matches m
    join public.match_sides ms on ms.match_id = m.id
    where ms.team_id = p_team_id
      and m.status = 'validated'
      and m.is_internal = false;

  return query
    select mp.user_id,
           p.name,
           p.photo_url,
           coalesce(sum(mp.goals), 0)::int   as goals,
           coalesce(sum(mp.assists), 0)::int as assists,
           count(*)::int                     as matches,
           case when v_total_goals = 0 then 0
                else round(100.0 * coalesce(sum(mp.goals), 0) / v_total_goals, 0)
           end as goal_share
    from public.match_participants mp
    join public.matches m   on m.id = mp.match_id
    join public.match_sides ms on ms.match_id = m.id
                              and ms.side = mp.side
                              and ms.team_id = p_team_id
    join public.profiles p on p.id = mp.user_id
    where m.status = 'validated'
      and m.is_internal = false
      and mp.attendance in ('attended','substitute_in')
    group by mp.user_id, p.name, p.photo_url
    having coalesce(sum(mp.goals), 0) > 0
        or coalesce(sum(mp.assists), 0) > 0
        or count(*) > 0
    order by goals desc, assists desc, matches desc
    limit p_limit;
end;
$$;

revoke all on function public.fetch_team_top_contributors(uuid, int) from public, anon;
grant execute on function public.fetch_team_top_contributors(uuid, int) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0042_team_announcement.sql
-- ──────────────────────────────────────────────────────────────────────────

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
