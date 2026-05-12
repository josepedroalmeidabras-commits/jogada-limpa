-- =============================================================================
-- PRE-MATCH AVAILABILITY (non-internal matches)
-- =============================================================================
-- Qualquer membro de uma das equipas envolvidas pode dizer "vou" / "não vou"
-- num jogo confirmado sem esperar pelo capitão convocar manualmente.
-- Insere/actualiza match_participants do user no lado da equipa dele.

create or replace function public.set_my_match_availability(
  p_match_id  uuid,
  p_available boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_match record;
  v_side  side;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select id, status, is_internal, scheduled_at into v_match
    from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if coalesce(v_match.is_internal, false) then
    raise exception 'Use the peladinha invite flow for internal matches';
  end if;
  if v_match.status not in ('confirmed', 'proposed', 'result_pending') then
    raise exception 'Match is not open for availability';
  end if;

  -- find which side the user is on (via team_members → match_sides)
  select ms.side into v_side
    from public.match_sides ms
    join public.team_members tm on tm.team_id = ms.team_id
    where ms.match_id = p_match_id and tm.user_id = v_user
    limit 1;
  if not found then
    raise exception 'You are not on either team';
  end if;

  insert into public.match_participants(match_id, user_id, side, invitation_status, responded_at)
  values (p_match_id, v_user, v_side, case when p_available then 'accepted' else 'declined' end, now())
  on conflict (match_id, user_id) do update set
    invitation_status = excluded.invitation_status,
    responded_at = excluded.responded_at,
    side = excluded.side;
end;
$$;

revoke all on function public.set_my_match_availability(uuid, boolean) from public, anon;
grant execute on function public.set_my_match_availability(uuid, boolean) to authenticated;
