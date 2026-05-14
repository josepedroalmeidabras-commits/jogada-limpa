-- =============================================================================
-- 0066 — TEST DATA SEED: peladinhas, amigos, reviews, faceoffs, pending stuff
-- =============================================================================
-- Idempotente: pode correr várias vezes sem duplicar (usa NOT EXISTS / ON CONFLICT).
-- Encontra o user "real" (não fake@jogadalimpa.local), preenche tudo o que ele
-- precisa para testar a app no Expo Go.
--
-- IMPORTANTE: deve ser removido com `delete from auth.users where email like 'fake%@jogadalimpa.local'`
-- antes do lançamento público (ver memory).

do $$
declare
  v_user_id       uuid;
  v_team_id       uuid;
  v_sport_id      int;
  v_match_id      uuid;
  v_score_a       int;
  v_score_b       int;
  v_my_side       text;
  v_fakes         uuid[];
  v_friends_added int := 0;
  v_pel_added     int := 0;
  v_rev_added     int := 0;
  v_face_added    int := 0;
  fake_id         uuid;
  comp_match      record;
  i               int;
begin
  -- ----- 1. Find the real user (José Pedro) -----
  select id into v_user_id
  from auth.users
  where email not like 'fake%@jogadalimpa.local'
    and email is not null
  order by created_at desc
  limit 1;

  if v_user_id is null then
    raise notice 'Nenhum user real encontrado — abort seed.';
    return;
  end if;

  -- ----- 2. Find his main team (captain first, else first membership) -----
  select t.id, t.sport_id into v_team_id, v_sport_id
  from public.teams t
  where t.captain_id = v_user_id and t.is_active
  order by t.created_at desc
  limit 1;

  if v_team_id is null then
    select t.id, t.sport_id into v_team_id, v_sport_id
    from public.teams t
    join public.team_members tm on tm.team_id = t.id
    where tm.user_id = v_user_id and t.is_active
    order by t.created_at desc
    limit 1;
  end if;

  if v_team_id is null then
    raise notice 'User % não pertence a nenhuma equipa — abort seed.', v_user_id;
    return;
  end if;

  -- ----- 3. Collect fake users that are also members of this team -----
  select array_agg(tm.user_id order by tm.joined_at) into v_fakes
  from public.team_members tm
  join auth.users u on u.id = tm.user_id
  where tm.team_id = v_team_id
    and u.email like 'fake%@jogadalimpa.local';

  if v_fakes is null or array_length(v_fakes, 1) < 7 then
    raise notice 'Equipa % tem menos de 7 fakes — peladinhas saltadas.', v_team_id;
  else
    -- ----- 4. Create 5 validated peladinhas, alternating sides for the user -----
    for i in 1..5 loop
      -- skip if we already seeded one with this distinctive note
      if not exists (
        select 1 from public.matches
        where is_internal
          and proposed_by = v_user_id
          and message = format('Peladinha seed #%s', i)
      ) then
        v_my_side := case when i % 2 = 0 then 'A' else 'B' end;
        v_score_a := 5 + (i % 4);                    -- 5..8
        v_score_b := case when v_my_side = 'A'
                          then v_score_a - 1 - (i % 2)  -- user wins on A
                          else v_score_a + 1 + (i % 2)  -- user wins on B
                     end;

        insert into public.matches (
          id, sport_id, scheduled_at, location_name, status,
          proposed_by, message, is_internal,
          side_a_label, side_b_label,
          final_score_a, final_score_b, validated_at, created_at
        ) values (
          uuid_generate_v4(),
          v_sport_id,
          now() - (i || ' days')::interval,
          'Campo da Cidade',
          'validated',
          v_user_id,
          format('Peladinha seed #%s', i),
          true,
          'Coletes', 'Sem Coletes',
          v_score_a, v_score_b,
          now() - (i || ' days')::interval + interval '90 minutes',
          now() - (i || ' days')::interval - interval '2 days'
        ) returning id into v_match_id;

        -- both sides = same team (peladinha rule)
        insert into public.match_sides (match_id, side, team_id, captain_id)
        values (v_match_id, 'A', v_team_id, v_user_id),
               (v_match_id, 'B', v_team_id, v_user_id);

        -- user participates on the chosen side
        insert into public.match_participants (
          match_id, user_id, side, invitation_status, attendance, responded_at
        ) values (
          v_match_id, v_user_id, v_my_side::side, 'accepted', 'attended', now()
        );

        -- 3 fakes on side A (skip user's slot), 3 on side B
        for j in 1..6 loop
          fake_id := v_fakes[j];
          if fake_id is not null and fake_id <> v_user_id then
            insert into public.match_participants (
              match_id, user_id, side, invitation_status, attendance, responded_at
            ) values (
              v_match_id,
              fake_id,
              (case when j <= 3 then (case when v_my_side='A' then 'B' else 'A' end) else v_my_side end)::side,
              'accepted', 'attended', now()
            ) on conflict do nothing;
          end if;
        end loop;

        v_pel_added := v_pel_added + 1;
      end if;
    end loop;

    -- ----- 5. One PENDING peladinha invite (announce-first, user pending) -----
    if not exists (
      select 1 from public.matches
      where is_internal
        and proposed_by = v_fakes[1]
        and message = 'Peladinha seed pendente'
    ) then
      insert into public.matches (
        id, sport_id, scheduled_at, location_name, status,
        proposed_by, message, is_internal,
        side_a_label, side_b_label
      ) values (
        uuid_generate_v4(),
        v_sport_id,
        now() + interval '2 days',
        'Campo da Cidade',
        'proposed',
        v_fakes[1],
        'Peladinha seed pendente',
        true,
        'Coletes', 'Sem Coletes'
      ) returning id into v_match_id;

      insert into public.match_sides (match_id, side, team_id, captain_id) values
        (v_match_id, 'A', v_team_id, v_fakes[1]),
        (v_match_id, 'B', v_team_id, v_fakes[1]);

      -- invite user as PENDING (this is what shows "Peladinhas · 1 por confirmar" on home)
      insert into public.match_participants (match_id, user_id, side, invitation_status)
      values (v_match_id, v_user_id, 'A', 'pending')
      on conflict do nothing;
    end if;
  end if;

  -- ----- 6. Friendships (5 fakes accepted as friends) -----
  if v_fakes is not null then
    for i in 1..least(array_length(v_fakes, 1), 6) loop
      fake_id := v_fakes[i];
      if fake_id <> v_user_id then
        insert into public.friendships (requester_id, addressee_id, status, accepted_at)
        values (v_user_id, fake_id, 'accepted', now() - interval '3 days')
        on conflict (requester_id, addressee_id) do nothing;
        v_friends_added := v_friends_added + 1;
      end if;
    end loop;
  end if;

  -- ----- 7. Team reviews — review opposing teams in past validated competitions -----
  for comp_match in
    select m.id as match_id, ms_opp.team_id as opp_team_id
    from public.matches m
    join public.match_sides ms_me  on ms_me.match_id = m.id and ms_me.team_id = v_team_id
    join public.match_sides ms_opp on ms_opp.match_id = m.id and ms_opp.team_id <> v_team_id
    join public.match_participants mp
      on mp.match_id = m.id and mp.user_id = v_user_id and mp.attendance in ('attended','substitute_in')
    where m.status = 'validated'
      and not coalesce(m.is_internal, false)
    limit 4
  loop
    insert into public.team_reviews (
      match_id, reviewer_id, reviewed_team_id,
      fair_play, punctuality, technical_level,
      visible_at
    ) values (
      comp_match.match_id, v_user_id, comp_match.opp_team_id,
      4 + (v_rev_added % 2),    -- 4 or 5
      4 + ((v_rev_added+1) % 2),
      3 + (v_rev_added % 3),    -- 3,4,5
      now() - interval '1 day'
    ) on conflict (match_id, reviewer_id, reviewed_team_id) do nothing;
    v_rev_added := v_rev_added + 1;
  end loop;

  -- ----- 8. Faceoff votes (user picks winners between his teammates) -----
  if v_fakes is not null and array_length(v_fakes, 1) >= 4 then
    declare
      a uuid; b uuid;
    begin
      for i in 1..4 loop
        a := v_fakes[i];
        b := v_fakes[i + 1];
        if a is not null and b is not null and a <> v_user_id and b <> v_user_id then
          insert into public.team_faceoff_votes (
            team_id, voter_id, player_low, player_high, winner_id
          ) values (
            v_team_id, v_user_id,
            least(a::text, b::text)::uuid,
            greatest(a::text, b::text)::uuid,
            case when i % 2 = 0 then a else b end
          ) on conflict do nothing;
          v_face_added := v_face_added + 1;
        end if;
      end loop;
    end;
  end if;

  raise notice 'SEED FEITO: peladinhas=%, amigos=%, team_reviews=%, faceoffs=%',
    v_pel_added, v_friends_added, v_rev_added, v_face_added;
end;
$$;
