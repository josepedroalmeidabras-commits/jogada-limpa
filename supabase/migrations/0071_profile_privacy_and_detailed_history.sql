-- =============================================================================
-- 0071 — Privacidade de perfil + histórico detalhado para a UI Flashscore-style
-- =============================================================================
-- A. `profiles.is_private` (default false). Quando true, apenas o próprio user
--    ou amigos accepted podem ver o histórico detalhado.
-- B. RPC `fetch_user_match_history_detailed` retorna linhas ricas (datas,
--    nomes, golos/assists do user, MVP, resultado W/D/L) para alimentar a
--    nova página de últimos jogos.

alter table public.profiles
  add column if not exists is_private boolean not null default false;

create or replace function public.fetch_user_match_history_detailed(
  p_user_id uuid,
  p_limit int default 30
) returns table (
  match_id      uuid,
  scheduled_at  timestamptz,
  is_internal   boolean,
  side_a_name   text,
  side_b_name   text,
  side_a_photo  text,
  side_b_photo  text,
  final_score_a int,
  final_score_b int,
  my_side       text,
  my_goals      int,
  my_assists    int,
  result        text,
  is_mvp        boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_me uuid := auth.uid();
  v_target_private bool;
  v_is_friend bool;
begin
  if v_me is null then return; end if;

  select coalesce(is_private, false) into v_target_private
  from public.profiles where id = p_user_id;

  if v_target_private and v_me <> p_user_id then
    select exists(
      select 1 from public.friendships
      where status = 'accepted'
        and ((requester_id = v_me and addressee_id = p_user_id)
          or (requester_id = p_user_id and addressee_id = v_me))
    ) into v_is_friend;
    if not v_is_friend then return; end if;
  end if;

  return query
  with my_matches as (
    select mp.match_id, mp.side as my_side,
           coalesce(mp.goals, 0) as my_goals,
           coalesce(mp.assists, 0) as my_assists
    from public.match_participants mp
    where mp.user_id = p_user_id
      and mp.attendance in ('attended', 'substitute_in')
  ),
  mvp_winners as (
    select v.match_id, v.mvp_user_id,
           rank() over (partition by v.match_id order by count(*) desc) as r
    from public.match_mvp_votes v
    group by v.match_id, v.mvp_user_id
  )
  select
    m.id,
    m.scheduled_at,
    coalesce(m.is_internal, false),
    case when coalesce(m.is_internal, false) and m.side_a_label is not null
         then m.side_a_label else ta.name end,
    case when coalesce(m.is_internal, false) and m.side_b_label is not null
         then m.side_b_label else tb.name end,
    ta.photo_url,
    tb.photo_url,
    m.final_score_a,
    m.final_score_b,
    mm.my_side::text,
    mm.my_goals,
    mm.my_assists,
    (case
      when mm.my_side = 'A' and m.final_score_a > m.final_score_b then 'W'
      when mm.my_side = 'B' and m.final_score_b > m.final_score_a then 'W'
      when m.final_score_a = m.final_score_b then 'D'
      else 'L'
    end)::text,
    exists (
      select 1 from mvp_winners w
      where w.match_id = m.id and w.mvp_user_id = p_user_id and w.r = 1
    )
  from my_matches mm
  join public.matches m on m.id = mm.match_id
  join public.match_sides msa on msa.match_id = m.id and msa.side = 'A'
  join public.match_sides msb on msb.match_id = m.id and msb.side = 'B'
  join public.teams ta on ta.id = msa.team_id
  join public.teams tb on tb.id = msb.team_id
  where m.status = 'validated'
    and m.final_score_a is not null
    and m.final_score_b is not null
  order by m.scheduled_at desc
  limit p_limit;
end;
$$;

grant execute on function public.fetch_user_match_history_detailed(uuid, int) to authenticated;
