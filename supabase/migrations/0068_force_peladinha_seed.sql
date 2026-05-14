-- =============================================================================
-- 0068 — força peladinhas de teste mesmo sem fakes na equipa do user
-- =============================================================================
-- A 0066 saltou se v_team_id não tivesse 7 fakes membros. Agora usa fakes
-- globais (em auth.users com email like 'fake%@jogadalimpa.local') —
-- match_participants não exige membership de team, só participação.
--
-- Também distribui golos/assists pelos participantes para que o
-- threshold IN FORM (3+ G+A em 7 dias) possa disparar no user real.

do $$
declare
  v_user_id   uuid;
  v_team_id   uuid;
  v_sport_id  int;
  v_match_id  uuid;
  v_score_a   int;
  v_score_b   int;
  v_my_side   text;
  v_other     text;
  v_fakes     uuid[];
  v_pel_added int := 0;
  v_frs_added int := 0;
  fake_id     uuid;
  i           int;
  j           int;
  my_goals    int;
  my_assists  int;
begin
  -- 1. user real COM PROFILE (evita signups incompletos)
  select p.id into v_user_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email is not null
    and u.email not like 'fake%@jogadalimpa.local'
    and p.deleted_at is null
  order by p.created_at desc
  limit 1;
  if v_user_id is null then raise notice 'Sem user real com profile.'; return; end if;

  -- 2. team_id: qualquer equipa do user, senão Bombs FC, senão a primeira activa
  select t.id, t.sport_id into v_team_id, v_sport_id
  from public.teams t
  join public.team_members tm on tm.team_id = t.id
  where tm.user_id = v_user_id and t.is_active
  order by t.created_at desc limit 1;

  if v_team_id is null then
    select t.id, t.sport_id into v_team_id, v_sport_id
    from public.teams t
    where t.is_active and lower(t.name) like '%bombs%'
    limit 1;
  end if;

  if v_team_id is null then
    select t.id, t.sport_id into v_team_id, v_sport_id
    from public.teams t where t.is_active order by t.created_at asc limit 1;
  end if;

  if v_team_id is null then raise notice 'Sem equipas activas.'; return; end if;

  -- Adiciona o user como membro dessa equipa caso ainda não esteja
  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_user_id, 'member')
  on conflict (team_id, user_id) do nothing;

  -- 3. fakes COM PROFILE
  select array_agg(p.id order by p.created_at) into v_fakes
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like 'fake%@jogadalimpa.local'
    and p.deleted_at is null
  limit 8;

  if v_fakes is null or array_length(v_fakes, 1) < 6 then
    raise notice 'Menos de 6 fakes com profile — abort.';
    return;
  end if;

  -- 4. Peladinhas (idempotente via message marker novo)
  for i in 1..5 loop
    if exists (
      select 1 from public.matches
      where is_internal and message = format('Peladinha v2 #%s (user=%s)', i, v_user_id)
    ) then
      continue;
    end if;

    v_my_side := case when i % 2 = 0 then 'A' else 'B' end;
    v_other   := case when v_my_side = 'A' then 'B' else 'A' end;
    v_score_a := 5 + (i % 4);
    v_score_b := case when v_my_side = 'A'
                      then v_score_a - 1 - (i % 2)
                      else v_score_a + 1 + (i % 2)
                 end;

    insert into public.matches (
      sport_id, scheduled_at, location_name, status,
      proposed_by, message, is_internal,
      side_a_label, side_b_label,
      final_score_a, final_score_b, validated_at, created_at
    ) values (
      v_sport_id,
      now() - (i || ' days')::interval,
      'Campo da Cidade',
      'validated',
      v_user_id,
      format('Peladinha v2 #%s (user=%s)', i, v_user_id),
      true,
      'Coletes', 'Sem Coletes',
      v_score_a, v_score_b,
      now() - (i || ' days')::interval + interval '90 minutes',
      now() - (i || ' days')::interval - interval '2 days'
    ) returning id into v_match_id;

    insert into public.match_sides (match_id, side, team_id, captain_id)
    values (v_match_id, 'A', v_team_id, v_user_id),
           (v_match_id, 'B', v_team_id, v_user_id);

    -- user no v_my_side, com 1 ou 2 golos + 1 assist (alimenta IN FORM)
    my_goals   := case when i <= 3 then 1 else 2 end;
    my_assists := case when i % 2 = 0 then 1 else 0 end;

    insert into public.match_participants (
      match_id, user_id, side, invitation_status, attendance, responded_at,
      goals, assists
    ) values (
      v_match_id, v_user_id, v_my_side::side, 'accepted', 'attended', now(),
      my_goals, my_assists
    );

    -- 6 fakes — 3 do lado oposto, 3 do mesmo lado do user
    -- distribui os golos restantes entre eles
    for j in 1..6 loop
      fake_id := v_fakes[j];
      if fake_id is not null and fake_id <> v_user_id then
        insert into public.match_participants (
          match_id, user_id, side, invitation_status, attendance, responded_at,
          goals, assists
        ) values (
          v_match_id, fake_id,
          (case when j <= 3 then v_other else v_my_side end)::side,
          'accepted', 'attended', now(),
          (case when j <= 2 then 1 else 0 end),  -- 2 fakes adversários com 1 golo
          (case when j = 4 then 1 else 0 end)    -- 1 fake do meu lado com assist
        ) on conflict do nothing;
      end if;
    end loop;

    v_pel_added := v_pel_added + 1;
  end loop;

  -- 5. Friendships fallback (caso a 0066 não tenha adicionado)
  for i in 1..least(array_length(v_fakes, 1), 6) loop
    fake_id := v_fakes[i];
    if fake_id <> v_user_id then
      insert into public.friendships (requester_id, addressee_id, status, accepted_at)
      values (v_user_id, fake_id, 'accepted', now() - interval '3 days')
      on conflict (requester_id, addressee_id) do nothing;
      v_frs_added := v_frs_added + 1;
    end if;
  end loop;

  raise notice 'PELADINHA SEED v2: peladinhas=%, friendships=%, team=%',
    v_pel_added, v_frs_added, v_team_id;
end $$;
