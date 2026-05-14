-- =============================================================================
-- 0084 — Backend hardening pre-launch (audit fixes)
-- =============================================================================
-- Fixes do audit de 2026-05-14, focados nos pontos que afectam integridade
-- de dados antes do lançamento público.
--
--   #4 (🟠) `submit_match_side_result` não rejeitava participants cujo
--          user_id não pertence ao roster da side (UPDATE silencioso filtrava
--          falsos UUIDs, mas capitão podia atribuir golos a jogadores
--          convidados/não-presentes sem qualquer aviso).
--   #6 (🟡) View `player_stats_aggregate` não filtrava `profiles.deleted_at`.
--   #7 (🟡) View `team_review_aggregates` não filtrava matches `disputed`/
--          `cancelled` — reviews de jogos contestados contavam.
--
-- Os outros achados do audit (race condition em accept_substitute_request,
-- review_aggregates "leak", is_friend) são falsos positivos após verificação.

-- ─── #4: submit_match_side_result com validação estrita de participants ────
create or replace function public.submit_match_side_result(
  p_match_id     uuid,
  p_score_a      int,
  p_score_b      int,
  p_participants jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_status      match_status;
  v_side        side;
  v_row         jsonb;
  v_uid         uuid;
  v_attended    boolean;
  v_goals       int;
  v_assists     int;
  v_total_goals int := 0;
  v_total_assists int := 0;
  v_my_score    int;
  v_unknown_uid uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
    raise exception 'Scores têm de ser inteiros não-negativos';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then raise exception 'Jogo não existe'; end if;
  if v_status not in ('confirmed', 'result_pending', 'disputed') then
    raise exception 'Jogo não está pronto para resultado';
  end if;

  select side into v_side from public.match_sides
    where match_id = p_match_id and captain_id = v_user;
  if not found then raise exception 'Só capitães podem submeter resultado'; end if;

  -- Pré-validação 1: cada user_id em p_participants TEM de estar em
  --   match_participants para este match e este side. Bloqueia UUIDs
  --   fantasma + atribuição cruzada de side adversária.
  if p_participants is not null then
    select (v_row->>'user_id')::uuid into v_unknown_uid
    from jsonb_array_elements(p_participants) v_row
    where not exists (
      select 1 from public.match_participants mp
      where mp.match_id = p_match_id
        and mp.side     = v_side
        and mp.user_id  = (v_row->>'user_id')::uuid
    )
    limit 1;

    if v_unknown_uid is not null then
      raise exception 'Participant % não pertence ao roster da equipa neste jogo',
        v_unknown_uid;
    end if;
  end if;

  -- Pré-validação 2: soma golos/assists não excede score do lado
  if p_participants is not null then
    for v_row in select * from jsonb_array_elements(p_participants) loop
      v_goals   := greatest(0, coalesce((v_row->>'goals')::int, 0));
      v_assists := greatest(0, coalesce((v_row->>'assists')::int, 0));
      v_total_goals := v_total_goals + v_goals;
      v_total_assists := v_total_assists + v_assists;
    end loop;
  end if;

  v_my_score := case when v_side = 'A'::side then p_score_a else p_score_b end;

  if v_total_goals > v_my_score then
    raise exception 'Os golos individuais (%) não podem ultrapassar o resultado da equipa (%)',
      v_total_goals, v_my_score;
  end if;
  if v_total_assists > v_my_score then
    raise exception 'As assistências individuais (%) não podem ultrapassar o resultado da equipa (%)',
      v_total_assists, v_my_score;
  end if;

  -- Reset baseline
  update public.match_participants
    set attendance   = 'missed'::attendance,
        goals        = 0,
        assists      = 0,
        responded_at = now()
    where match_id = p_match_id and side = v_side;

  -- Aplicar dados (já validados acima)
  if p_participants is not null then
    for v_row in select * from jsonb_array_elements(p_participants) loop
      v_uid      := (v_row->>'user_id')::uuid;
      v_attended := coalesce((v_row->>'attended')::boolean, true);
      v_goals    := greatest(0, coalesce((v_row->>'goals')::int, 0));
      v_assists  := greatest(0, coalesce((v_row->>'assists')::int, 0));

      update public.match_participants
        set attendance = case when v_attended then 'attended'::attendance else 'missed'::attendance end,
            goals      = v_goals,
            assists    = v_assists,
            responded_at = now()
        where match_id = p_match_id and side = v_side and user_id = v_uid;
    end loop;
  end if;

  -- Score submission
  insert into public.match_score_submissions(
    match_id, submitted_by_side, score_a, score_b, submitted_by
  )
  values (p_match_id, v_side, p_score_a, p_score_b, v_user)
  on conflict (match_id, submitted_by_side) do update
    set score_a = excluded.score_a,
        score_b = excluded.score_b,
        submitted_by = excluded.submitted_by,
        submitted_at = now();

  update public.matches
    set status = 'result_pending'
    where id = p_match_id and status = 'confirmed';
end;
$$;

revoke all on function public.submit_match_side_result(uuid, int, int, jsonb) from public, anon;
grant execute on function public.submit_match_side_result(uuid, int, int, jsonb) to authenticated;

-- ─── #6: player_stats_aggregate exclui perfis soft-deleted ───────────────
drop view if exists public.player_stats_aggregate;
create view public.player_stats_aggregate as
select
  v.target_id                                                  as user_id,
  v.category::text                                             as category,
  public.compute_stat_aggregate(v.target_id, v.category::text) as value,
  count(*)::int                                                as votes
from public.player_stat_votes v
join public.profiles p on p.id = v.target_id
where p.deleted_at is null
group by v.target_id, v.category;

grant select on public.player_stats_aggregate to authenticated, anon;

-- ─── #7: team_review_aggregates exclui matches disputed/cancelled ────────
drop view if exists public.team_review_aggregates;
create view public.team_review_aggregates as
select
  tr.reviewed_team_id                                                          as team_id,
  count(*)::int                                                                as total_reviews,
  avg(coalesce(tr.overall, (tr.fair_play + tr.punctuality + tr.technical_level) / 3.0)) as avg_overall,
  avg(tr.fair_play)                                                            as avg_fair_play,
  avg(tr.punctuality)                                                          as avg_punctuality,
  avg(tr.technical_level)                                                      as avg_technical_level
from public.team_reviews tr
join public.matches m on m.id = tr.match_id
where tr.comment_moderation_status <> 'rejected'
  and tr.visible_at is not null
  and tr.visible_at <= now()
  and m.status not in ('disputed', 'cancelled')
group by tr.reviewed_team_id;

grant select on public.team_review_aggregates to authenticated, anon;

-- Bónus: review_aggregates (singular, individual users) com mesmo filtro
drop view if exists public.review_aggregates;
create view public.review_aggregates as
select
  r.reviewed_id                                                                as user_id,
  count(*)::int                                                                as total_reviews,
  avg(coalesce(r.overall, (r.fair_play + r.punctuality + r.technical_level) / 3.0)) as avg_overall,
  avg(r.fair_play)                                                             as avg_fair_play,
  avg(r.punctuality)                                                           as avg_punctuality,
  avg(r.technical_level)                                                       as avg_technical_level
from public.reviews r
join public.matches m on m.id = r.match_id
join public.profiles p on p.id = r.reviewed_id
where r.comment_moderation_status <> 'rejected'
  and r.visible_at is not null
  and r.visible_at <= now()
  and m.status not in ('disputed', 'cancelled')
  and p.deleted_at is null
group by r.reviewed_id;

grant select on public.review_aggregates to authenticated, anon;
