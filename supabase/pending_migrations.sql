-- ============================================================================
-- Promover user real a capitão + criar 2 jogos futuros (peladinha + amigável)
-- para testar o flow de substitutos
-- ============================================================================

do $$
declare
  v_user        uuid;
  v_bombs       uuid;
  v_old_captain uuid;
  v_opp         uuid;
  v_match_id    uuid;
  v_members     uuid[];
  k int;
begin
  -- Identificar user real
  select p.id into v_user
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email not like 'fake%@jogadalimpa.local' and p.deleted_at is null
  order by p.created_at desc limit 1;
  if v_user is null then raise exception 'User real não encontrado'; end if;

  -- Bombs FC
  select id, captain_id into v_bombs, v_old_captain
  from public.teams where name = 'Bombs FC' limit 1;
  if v_bombs is null then raise exception 'Bombs FC não existe'; end if;

  -- Garante que o user real é member primeiro
  insert into public.team_members (team_id, user_id, role)
  values (v_bombs, v_user, 'captain')
  on conflict (team_id, user_id) do update set role = 'captain';

  -- Despromove o captain antigo (se diferente) para member
  if v_old_captain is not null and v_old_captain <> v_user then
    update public.team_members
      set role = 'member'
      where team_id = v_bombs and user_id = v_old_captain;
  end if;

  -- Atualiza captain_id da equipa
  update public.teams set captain_id = v_user where id = v_bombs;

  -- ===== Peladinha 7v7 (daqui a 2 dias, 19h) =====
  insert into public.matches (
    sport_id, scheduled_at, location_name, status,
    proposed_by, message, is_internal,
    side_a_label, side_b_label
  ) values (
    2, date_trunc('day', now()) + interval '2 days' + interval '19 hours',
    'Campo do Calhabé', 'confirmed',
    v_user, 'Peladinha de teste', true,
    'Coletes', 'Sem Coletes'
  ) returning id into v_match_id;

  insert into public.match_sides (match_id, side, team_id, captain_id) values
    (v_match_id, 'A', v_bombs, v_user),
    (v_match_id, 'B', v_bombs, v_user);

  -- Sorteia 14 membros da Bombs FC e mete 7+7
  select array_agg(user_id) into v_members
  from (select user_id from public.team_members where team_id = v_bombs
        and user_id <> v_user
        order by random() limit 14) x;

  -- Mete o user real do lado A primeiro
  insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
  values (v_match_id, v_user, 'A', 'accepted', null) on conflict do nothing;

  -- Coletes (A): primeiros 6 fakes
  for k in 1..6 loop
    insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
    values (v_match_id, v_members[k], 'A', 'accepted', null) on conflict do nothing;
  end loop;
  -- Sem Coletes (B): próximos 7 fakes
  for k in 7..13 loop
    insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
    values (v_match_id, v_members[k], 'B', 'accepted', null) on conflict do nothing;
  end loop;

  -- Simular 1 jogador que recusou (gera o card "1 jogador não vai")
  update public.match_participants
    set invitation_status = 'declined'
    where match_id = v_match_id and user_id = v_members[13];


  -- ===== Amigável Bombs FC vs Solum Stars (daqui a 4 dias, 20h) =====
  select id into v_opp from public.teams where name = 'Solum Stars' limit 1;

  insert into public.matches (
    sport_id, scheduled_at, location_name, status,
    proposed_by, message, is_internal
  ) values (
    2, date_trunc('day', now()) + interval '4 days' + interval '20 hours',
    'Campo Municipal de Celas', 'confirmed',
    v_user, 'Amigável de teste', false
  ) returning id into v_match_id;

  insert into public.match_sides (match_id, side, team_id, captain_id) values
    (v_match_id, 'A', v_bombs, v_user),
    (v_match_id, 'B', v_opp, (select captain_id from public.teams where id = v_opp));

  -- User real no lado A
  insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
  values (v_match_id, v_user, 'A', 'accepted', null) on conflict do nothing;

  -- + 6 da Bombs FC
  select array_agg(user_id) into v_members
  from (select user_id from public.team_members where team_id = v_bombs
        and user_id <> v_user
        order by random() limit 6) x;
  for k in 1..6 loop
    insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
    values (v_match_id, v_members[k], 'A', 'accepted', null) on conflict do nothing;
  end loop;

  -- 7 da Solum Stars
  select array_agg(user_id) into v_members
  from (select user_id from public.team_members where team_id = v_opp order by random() limit 7) x;
  for k in 1..7 loop
    insert into public.match_participants (match_id, user_id, side, invitation_status, attendance)
    values (v_match_id, v_members[k], 'B', 'accepted', null) on conflict do nothing;
  end loop;
end $$;

-- Verificação
select 'real_user_id' as kind, (select p.id::text from public.profiles p
  join auth.users u on u.id = p.id
  where u.email not like 'fake%@jogadalimpa.local' and p.deleted_at is null
  order by p.created_at desc limit 1) as value
union all
select 'bombs_captain', (select captain_id::text from public.teams where name = 'Bombs FC')
union all
select 'future_matches', (select count(*)::text from public.matches
  where status = 'confirmed' and scheduled_at > now());
