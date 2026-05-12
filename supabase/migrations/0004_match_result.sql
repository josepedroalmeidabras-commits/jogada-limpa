-- =============================================================================
-- Auto-convocação dos membros + RPC para submeter resultado por lado
-- =============================================================================

-- Re-define accept_match: agora também adiciona os membros das equipas como
-- match_participants (invitation_status='accepted'). Mantém SECURITY DEFINER.
create or replace function public.accept_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user           uuid := auth.uid();
  v_status         match_status;
  v_is_captain_b   boolean;
  v_team_a         uuid;
  v_team_b         uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;

  if v_status <> 'proposed' then
    raise exception 'Match is not pending acceptance';
  end if;

  select exists(
    select 1 from public.match_sides
    where match_id = p_match_id and side = 'B' and captain_id = v_user
  ) into v_is_captain_b;

  if not v_is_captain_b then
    raise exception 'Only the opposing captain can accept';
  end if;

  select team_id into v_team_a
    from public.match_sides where match_id = p_match_id and side = 'A';
  select team_id into v_team_b
    from public.match_sides where match_id = p_match_id and side = 'B';

  update public.matches set status = 'confirmed' where id = p_match_id;

  -- auto-add members of both teams as participants
  insert into public.match_participants(match_id, user_id, side, invitation_status)
    select p_match_id, tm.user_id, 'A'::side, 'accepted'::invitation_status
      from public.team_members tm
      where tm.team_id = v_team_a
    on conflict (match_id, user_id) do nothing;

  insert into public.match_participants(match_id, user_id, side, invitation_status)
    select p_match_id, tm.user_id, 'B'::side, 'accepted'::invitation_status
      from public.team_members tm
      where tm.team_id = v_team_b
    on conflict (match_id, user_id) do nothing;
end;
$$;

grant execute on function public.accept_match(uuid) to authenticated;

-- ===================== submit_match_side_result ===========================
-- Insere score submission do lado do capitão + marca attendance dos jogadores
-- presentes. Quando ambos os lados submetem com scores iguais, o trigger
-- existente (tg_score_submitted) marca o match como 'validated' e o
-- tg_match_validated dispara o cálculo de ELO.
create or replace function public.submit_match_side_result(
  p_match_id           uuid,
  p_score_a            int,
  p_score_b            int,
  p_attended_user_ids  uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_status     match_status;
  v_side       side;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
    raise exception 'Scores must be non-negative integers';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;

  if v_status not in ('confirmed', 'result_pending', 'disputed') then
    raise exception 'Match is not ready for results';
  end if;

  select side into v_side from public.match_sides
    where match_id = p_match_id and captain_id = v_user;
  if not found then
    raise exception 'Only captains can submit results';
  end if;

  -- update attendance for this side's participants
  update public.match_participants
    set attendance = case
      when user_id = any (coalesce(p_attended_user_ids, '{}'::uuid[])) then 'attended'::attendance
      else 'missed'::attendance
    end,
    responded_at = now()
    where match_id = p_match_id and side = v_side;

  -- upsert score submission for this side
  insert into public.match_score_submissions(
    match_id, submitted_by_side, score_a, score_b, submitted_by
  )
  values (p_match_id, v_side, p_score_a, p_score_b, v_user)
  on conflict (match_id, submitted_by_side) do update
    set score_a = excluded.score_a,
        score_b = excluded.score_b,
        submitted_by = excluded.submitted_by,
        submitted_at = now();

  -- mark match as result_pending if currently confirmed
  update public.matches
    set status = 'result_pending'
    where id = p_match_id and status = 'confirmed';
end;
$$;

revoke all on function public.submit_match_side_result(uuid, int, int, uuid[])
  from public, anon;
grant execute on function public.submit_match_side_result(uuid, int, int, uuid[])
  to authenticated;
