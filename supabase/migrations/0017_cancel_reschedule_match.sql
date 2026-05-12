-- =============================================================================
-- CANCEL + RESCHEDULE CONFIRMED MATCHES
-- =============================================================================
-- Captains can cancel or reschedule a confirmed match before it is played.
-- Both notify the opposing captain.

alter table public.matches add column if not exists cancelled_at timestamptz;

-- ============================ cancel_confirmed_match ======================
create or replace function public.cancel_confirmed_match(
  p_match_id uuid,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_status    match_status;
  v_involved  boolean;
  v_match     record;
  v_opp_capt  uuid;
  v_my_team   text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Cancellation reason required';
  end if;

  select id, status, scheduled_at into v_match
    from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;
  v_status := v_match.status;

  if v_status not in ('confirmed', 'result_pending') then
    raise exception 'Only confirmed or pending-result matches can be cancelled';
  end if;

  if v_match.scheduled_at is not null and v_match.scheduled_at < now() - interval '24 hours' then
    raise exception 'Cannot cancel a match older than 24h after kickoff';
  end if;

  -- captain must be on either side
  select exists(
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) into v_involved;
  if not v_involved then
    raise exception 'Only the involved captains can cancel';
  end if;

  -- opposing captain (the one that is not the canceller)
  select ms.captain_id, t.name
    into v_opp_capt, v_my_team
    from public.match_sides ms
    join public.teams t on t.id = ms.team_id
    where ms.match_id = p_match_id and ms.captain_id <> v_user
    limit 1;

  -- my team (for the notification body)
  select t.name into v_my_team
    from public.match_sides ms
    join public.teams t on t.id = ms.team_id
    where ms.match_id = p_match_id and ms.captain_id = v_user
    limit 1;

  update public.matches
    set status = 'cancelled',
        cancelled_reason = p_reason,
        cancelled_at = now()
    where id = p_match_id;

  if v_opp_capt is not null then
    insert into public.notifications(user_id, type, title, body, payload, channel)
    values (
      v_opp_capt,
      'match_cancelled',
      'Jogo cancelado',
      coalesce(v_my_team || ' cancelou: ' || p_reason, p_reason),
      jsonb_build_object('match_id', p_match_id::text, 'reason', p_reason),
      'in_app'
    );
  end if;
end;
$$;

revoke all on function public.cancel_confirmed_match(uuid, text) from public, anon;
grant execute on function public.cancel_confirmed_match(uuid, text) to authenticated;


-- ============================ reschedule_match ============================
create or replace function public.reschedule_match(
  p_match_id      uuid,
  p_scheduled_at  timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_status    match_status;
  v_involved  boolean;
  v_match     record;
  v_opp_capt  uuid;
  v_my_team   text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_scheduled_at is null then
    raise exception 'New date required';
  end if;
  if p_scheduled_at < now() then
    raise exception 'New date must be in the future';
  end if;

  select id, status, scheduled_at into v_match
    from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;
  v_status := v_match.status;

  if v_status not in ('proposed', 'confirmed') then
    raise exception 'Only proposed or confirmed matches can be rescheduled';
  end if;

  select exists(
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) into v_involved;
  if not v_involved then
    raise exception 'Only the involved captains can reschedule';
  end if;

  select ms.captain_id
    into v_opp_capt
    from public.match_sides ms
    where ms.match_id = p_match_id and ms.captain_id <> v_user
    limit 1;

  select t.name into v_my_team
    from public.match_sides ms
    join public.teams t on t.id = ms.team_id
    where ms.match_id = p_match_id and ms.captain_id = v_user
    limit 1;

  -- A reschedule on a confirmed match reverts to proposed so the other side re-accepts.
  update public.matches
    set scheduled_at = p_scheduled_at,
        status = case when v_status = 'confirmed' then 'proposed' else v_status end,
        proposed_by = v_user
    where id = p_match_id;

  -- If we reverted to proposed, ensure proposing side is set to canceller's side
  -- (handled implicitly via proposed_by)

  if v_opp_capt is not null then
    insert into public.notifications(user_id, type, title, body, payload, channel)
    values (
      v_opp_capt,
      'match_rescheduled',
      'Jogo remarcado',
      coalesce(v_my_team, 'Adversário') || ' propõe nova data: ' ||
        to_char(p_scheduled_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI'),
      jsonb_build_object('match_id', p_match_id::text, 'scheduled_at', p_scheduled_at),
      'in_app'
    );
  end if;
end;
$$;

revoke all on function public.reschedule_match(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_match(uuid, timestamptz) to authenticated;
