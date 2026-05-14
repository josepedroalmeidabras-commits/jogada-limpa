-- =============================================================================
-- 0081 — Validação no submit_match_side_result
-- =============================================================================
-- Rejeita submissões onde sum(goals) ou sum(assists) excedem o score do
-- próprio lado. Safety net contra erros do capitão.

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

  -- Pré-validação: soma de golos/assists não pode exceder o score do lado
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

  -- Aplicar dados
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

grant execute on function public.submit_match_side_result(uuid, int, int, jsonb) to authenticated;
