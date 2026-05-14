-- =============================================================================
-- SEED: stats votes + goals + assists para visualização
-- =============================================================================
-- Cria a sensação de "a comunidade já votou" preenchendo player_stat_votes
-- para todos os perfis activos, e adiciona golos/assistências aos jogos
-- validados existentes. José Pedro entra como substituto em 2 jogos para o
-- seu próprio FUT card ter números.

-- ----------------------------------------------------------------------------
-- 1. player_stat_votes para todos
-- ----------------------------------------------------------------------------
-- Para cada profile (target), pegamos 4 voters determinísticos (outras pessoas).
-- Para cada categoria (todas as 11 — campo + GK), valor base 50 + hash %40.
-- Se a categoria não for relevante para a posição do target, o UI nem mostra.

insert into public.player_stat_votes (voter_id, target_id, category, value)
select
  v.id::uuid as voter_id,
  t.id::uuid as target_id,
  c.cat::player_stat_category as category,
  (50 + (abs(hashtext(t.id::text || c.cat || v.id::text)) % 40))::smallint as value
from public.profiles t
cross join lateral (
  select id
  from public.profiles
  where deleted_at is null
    and id <> t.id
  order by md5(id::text || t.id::text)
  limit 4
) v
cross join unnest(array[
  'velocidade', 'remate', 'drible', 'passe', 'defesa', 'fisico',
  'reflexos', 'defesa_aerea', 'posicionamento', 'distribuicao', 'saidas'
]) as c(cat)
where t.deleted_at is null
on conflict (voter_id, target_id, category) do nothing;


-- ----------------------------------------------------------------------------
-- 2. Goals + assists nos participantes existentes
-- ----------------------------------------------------------------------------
-- Distribuição determinística baseada em hash do (match_id, user_id).
-- Resultado: cada participante fica com 0-2 golos e 0-2 assistências.
-- Não bate exactamente com final_score mas dá vida visual suficiente.

update public.match_participants mp
  set
    goals   = (abs(hashtext(mp.match_id::text || mp.user_id::text || 'g')) % 3)::smallint,
    assists = (abs(hashtext(mp.match_id::text || mp.user_id::text || 'a')) % 3)::smallint
from public.matches m
where m.id = mp.match_id
  and m.status = 'validated'
  and mp.attendance = 'attended'
  and coalesce(mp.goals, 0) = 0
  and coalesce(mp.assists, 0) = 0;


-- ----------------------------------------------------------------------------
-- 3. José Pedro entra como substituto em 2 jogos
-- ----------------------------------------------------------------------------
do $$
declare
  v_jp uuid;
  v_match_a uuid;
  v_match_b uuid;
begin
  -- Pick the real user (not a fake@jogadalimpa.local seed account)
  select p.id into v_jp
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.deleted_at is null
    and u.email not like 'fake%@jogadalimpa.local'
  order by p.created_at asc
  limit 1;

  if v_jp is null then return; end if;

  -- Pick 2 most-recent validated matches
  select m.id into v_match_a
    from public.matches m
    where m.status = 'validated'
    order by m.scheduled_at desc
    limit 1 offset 0;
  select m.id into v_match_b
    from public.matches m
    where m.status = 'validated'
    order by m.scheduled_at desc
    limit 1 offset 1;

  if v_match_a is not null then
    insert into public.match_participants (match_id, user_id, side, attendance, goals, assists)
    values (v_match_a, v_jp, 'A'::side, 'substitute_in', 1, 1)
    on conflict (match_id, user_id) do nothing;
  end if;

  if v_match_b is not null then
    insert into public.match_participants (match_id, user_id, side, attendance, goals, assists)
    values (v_match_b, v_jp, 'B'::side, 'substitute_in', 2, 0)
    on conflict (match_id, user_id) do nothing;
  end if;
end $$;
