-- =============================================================================
-- PELADINHA: invite selection + payment tracking
-- =============================================================================
-- 1. Capitão pode escolher quem convidar (default = todos os membros).
-- 2. Capitão pode marcar quem já pagou o jogo (pagamento é fora da app —
--    apenas tracking organizacional).

-- ----------------------------------------------------------------------------
-- 1. has_paid em match_participants
-- ----------------------------------------------------------------------------
alter table public.match_participants
  add column if not exists has_paid boolean not null default false;


-- ----------------------------------------------------------------------------
-- 2. announce_internal_match — aceita lista de jogadores a convidar
-- ----------------------------------------------------------------------------
-- Adicionamos um param opcional p_invite_user_ids. Como mudou a assinatura,
-- temos de dropar a versão antiga (que tinha 7 args).
drop function if exists public.announce_internal_match(uuid, timestamptz, text, boolean, text, text, text);

create or replace function public.announce_internal_match(
  p_team_id         uuid,
  p_scheduled_at    timestamptz,
  p_location_name   text default null,
  p_location_tbd    boolean default false,
  p_notes           text default null,
  p_side_a_label    text default null,
  p_side_b_label    text default null,
  p_invite_user_ids uuid[] default null  -- null = convida todos os membros
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_team  record;
  v_match uuid;
  v_invitee_count int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_scheduled_at is null then raise exception 'Scheduled date required'; end if;

  select * into v_team from public.teams where id = p_team_id and is_active;
  if not found then raise exception 'Team not found'; end if;

  if not public.is_team_leader(p_team_id, v_user) then
    raise exception 'Only the captain or sub-captain can announce peladinhas';
  end if;

  insert into public.matches(
    sport_id, scheduled_at, location_name, location_tbd, status,
    proposed_by, notes, is_internal, side_a_label, side_b_label
  ) values (
    v_team.sport_id, p_scheduled_at, p_location_name, coalesce(p_location_tbd, false),
    'confirmed', v_user, p_notes, true,
    coalesce(nullif(trim(p_side_a_label), ''), 'Coletes'),
    coalesce(nullif(trim(p_side_b_label), ''), 'Sem coletes')
  )
  returning id into v_match;

  insert into public.match_sides(match_id, side, team_id, captain_id) values
    (v_match, 'A', p_team_id, v_team.captain_id),
    (v_match, 'B', p_team_id, v_team.captain_id);

  -- Convida só os user_ids passados (ou todos se null).
  -- Restringe sempre a membros actuais da equipa (mesmo que o capitão passe
  -- um id que não pertence).
  insert into public.match_participants(match_id, user_id, side, invitation_status, attendance)
  select v_match, tm.user_id, 'A'::side, 'pending'::invitation_status, null
  from public.team_members tm
  where tm.team_id = p_team_id
    and (
      p_invite_user_ids is null
      or tm.user_id = any (p_invite_user_ids)
    );

  get diagnostics v_invitee_count = row_count;
  if v_invitee_count = 0 then
    raise exception 'No valid invitees selected';
  end if;

  -- Notificações in-app para todos os convidados (excepto quem anunciou).
  insert into public.notifications(user_id, type, title, body, payload, channel)
  select
    tm.user_id,
    'peladinha_invite',
    'Peladinha marcada',
    coalesce(v_team.name, 'A tua equipa') || ' marcou peladinha em ' ||
      to_char(p_scheduled_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI'),
    jsonb_build_object('match_id', v_match::text, 'team_id', p_team_id::text),
    'in_app'
  from public.team_members tm
  where tm.team_id = p_team_id
    and tm.user_id <> v_user
    and (
      p_invite_user_ids is null
      or tm.user_id = any (p_invite_user_ids)
    );

  return v_match;
end;
$$;

revoke all on function public.announce_internal_match(uuid, timestamptz, text, boolean, text, text, text, uuid[]) from public, anon;
grant execute on function public.announce_internal_match(uuid, timestamptz, text, boolean, text, text, text, uuid[]) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. mark_participant_paid — capitão/sub-capitão marca pagamento
-- ----------------------------------------------------------------------------
create or replace function public.mark_participant_paid(
  p_match_id uuid,
  p_user_id  uuid,
  p_paid     boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_match record;
  v_team_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select m.id, m.is_internal into v_match
    from public.matches m where m.id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if not coalesce(v_match.is_internal, false) then
    raise exception 'Payment tracking only applies to peladinhas';
  end if;

  -- A equipa da peladinha — em peladinhas o team_id é o mesmo nos dois lados.
  select ms.team_id into v_team_id
    from public.match_sides ms
    where ms.match_id = p_match_id
    limit 1;
  if v_team_id is null then raise exception 'Match has no team'; end if;

  if not public.is_team_leader(v_team_id, v_user) then
    raise exception 'Only the captain or sub-captain can mark payment';
  end if;

  update public.match_participants
    set has_paid = p_paid
    where match_id = p_match_id and user_id = p_user_id;
end;
$$;

revoke all on function public.mark_participant_paid(uuid, uuid, boolean) from public, anon;
grant execute on function public.mark_participant_paid(uuid, uuid, boolean) to authenticated;
