-- =============================================================================
-- INTERNAL MATCHES — peladinha entre membros da mesma equipa
-- =============================================================================
-- O caso "grupo de amigos joga sábados à noite contra eles próprios" — não há
-- adversário externo, capitão divide o plantel em dois lados ad-hoc.
--
-- Modelado simplesmente:
--   matches.is_internal     boolean (default false)
--   match_sides ambas linhas com o mesmo team_id (PK já permite)
--   match_participants distribuídos por side='A' / side='B'
--   ELO NÃO se mexe em jogos internos — não faz sentido competitivo
--   Golos/assistências/MVP/reviews/fotos continuam todos a funcionar
--
-- Labels opcionais (ex: "Coletes" vs "Sem coletes") para a UI ficar com graça.

alter table public.matches
  add column if not exists is_internal      boolean default false not null,
  add column if not exists side_a_label     text,
  add column if not exists side_b_label     text;


-- ============================ create_internal_match ========================
-- O capitão cria um jogo interno e atribui jogadores aos dois lados de uma
-- só vez. O match nasce já em status 'confirmed'.
create or replace function public.create_internal_match(
  p_team_id        uuid,
  p_scheduled_at   timestamptz,
  p_location_name  text default null,
  p_location_tbd   boolean default false,
  p_notes          text default null,
  p_side_a_label   text default null,
  p_side_b_label   text default null,
  p_side_a_user_ids uuid[] default '{}'::uuid[],
  p_side_b_user_ids uuid[] default '{}'::uuid[]
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
  v_uid   uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_scheduled_at is null then
    raise exception 'Scheduled date required';
  end if;

  select * into v_team from public.teams where id = p_team_id and is_active;
  if not found then
    raise exception 'Team not found';
  end if;
  if v_team.captain_id <> v_user then
    raise exception 'Only the team captain can create internal matches';
  end if;

  if array_length(p_side_a_user_ids, 1) is null or array_length(p_side_b_user_ids, 1) is null then
    raise exception 'Both sides need at least one player';
  end if;

  -- Validate that all proposed players are members of the team
  if exists (
    select unnest(p_side_a_user_ids || p_side_b_user_ids)
    except
    select user_id from public.team_members where team_id = p_team_id
  ) then
    raise exception 'All players must be members of the team';
  end if;

  -- No overlap between sides
  if exists (
    select 1
    from unnest(p_side_a_user_ids) a
    where a = any (p_side_b_user_ids)
  ) then
    raise exception 'A player cannot be on both sides';
  end if;

  insert into public.matches (
    sport_id, scheduled_at, location_name, location_tbd,
    status, proposed_by, notes,
    is_internal, side_a_label, side_b_label
  ) values (
    v_team.sport_id, p_scheduled_at, p_location_name, coalesce(p_location_tbd, false),
    'confirmed', v_user, p_notes,
    true,
    coalesce(nullif(trim(p_side_a_label), ''), 'Coletes'),
    coalesce(nullif(trim(p_side_b_label), ''), 'Sem coletes')
  )
  returning id into v_match;

  -- Both sides share the same team and captain
  insert into public.match_sides(match_id, side, team_id, captain_id) values
    (v_match, 'A', p_team_id, v_user),
    (v_match, 'B', p_team_id, v_user);

  -- Roster split
  foreach v_uid in array p_side_a_user_ids loop
    insert into public.match_participants(match_id, user_id, side, invitation_status, attendance)
      values (v_match, v_uid, 'A', 'accepted', null);
  end loop;
  foreach v_uid in array p_side_b_user_ids loop
    insert into public.match_participants(match_id, user_id, side, invitation_status, attendance)
      values (v_match, v_uid, 'B', 'accepted', null);
  end loop;

  return v_match;
end;
$$;

revoke all on function public.create_internal_match(uuid, timestamptz, text, boolean, text, text, text, uuid[], uuid[]) from public, anon;
grant execute on function public.create_internal_match(uuid, timestamptz, text, boolean, text, text, text, uuid[], uuid[]) to authenticated;


-- ============================ submit_internal_match_result =================
-- Em jogos internos só há um capitão (mesmo de ambos os lados) — submete o
-- resultado de uma vez e o match é validado imediatamente.
create or replace function public.submit_internal_match_result(
  p_match_id     uuid,
  p_score_a      int,
  p_score_b      int,
  p_participants jsonb  -- [{user_id, attended, goals, assists, side: 'A'|'B'}]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_status   match_status;
  v_internal boolean;
  v_row      jsonb;
  v_uid      uuid;
  v_attended boolean;
  v_goals    int;
  v_assists  int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_score_a < 0 or p_score_b < 0 then
    raise exception 'Scores must be non-negative';
  end if;

  select status, is_internal into v_status, v_internal
    from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if not coalesce(v_internal, false) then
    raise exception 'This match is not internal';
  end if;
  if v_status not in ('confirmed', 'result_pending', 'disputed') then
    raise exception 'Match not ready for results';
  end if;

  -- captain check (same captain on both sides)
  if not exists (
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) then
    raise exception 'Only the captain can submit';
  end if;

  -- Reset all attendance to missed
  update public.match_participants
    set attendance = 'missed', goals = 0, assists = 0, responded_at = now()
    where match_id = p_match_id;

  if p_participants is not null then
    for v_row in select * from jsonb_array_elements(p_participants) loop
      v_uid      := (v_row->>'user_id')::uuid;
      v_attended := coalesce((v_row->>'attended')::boolean, true);
      v_goals    := greatest(0, coalesce((v_row->>'goals')::int, 0));
      v_assists  := greatest(0, coalesce((v_row->>'assists')::int, 0));

      update public.match_participants
        set attendance = case when v_attended then 'attended'::attendance else 'missed'::attendance end,
            goals = v_goals, assists = v_assists, responded_at = now()
        where match_id = p_match_id and user_id = v_uid;
    end loop;
  end if;

  -- Validate the match immediately
  update public.matches
    set status        = 'validated',
        final_score_a = p_score_a,
        final_score_b = p_score_b,
        validated_at  = now()
    where id = p_match_id;
end;
$$;

revoke all on function public.submit_internal_match_result(uuid, int, int, jsonb) from public, anon;
grant execute on function public.submit_internal_match_result(uuid, int, int, jsonb) to authenticated;


-- =============================================================================
-- Skip ELO recompute for internal matches.
-- =============================================================================
-- The validation trigger fires on UPDATE; we now early-return when is_internal.
create or replace function public.tg_match_validated()
returns trigger language plpgsql as $$
begin
  if new.status = 'validated' and (old.status is distinct from 'validated') then
    new.validated_at := coalesce(new.validated_at, now());
    if not coalesce(new.is_internal, false) then
      perform public.calculate_match_elo(new.id);
    end if;
  end if;
  return new;
end; $$;
