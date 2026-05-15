-- =============================================================================
-- Screenshot polish: distribute goals + assists for validated matches
-- =============================================================================
-- Idempotent (resets goals/assists per match before re-distributing).

do $$
declare
  m_rec record;
  i int;
  scorer_id uuid;
  assister_id uuid;
  side_letter side;
  score_for_side int;
begin
  for m_rec in
    select id, final_score_a, final_score_b
    from public.matches
    where status = 'validated'
  loop
    -- Reset (idempotency)
    update public.match_participants
    set goals = 0, assists = 0
    where match_id = m_rec.id;

    foreach side_letter in array array['A'::side, 'B'::side] loop
      score_for_side := case side_letter
        when 'A' then coalesce(m_rec.final_score_a, 0)
        when 'B' then coalesce(m_rec.final_score_b, 0)
      end;

      for i in 1..score_for_side loop
        -- Pick random non-GK scorer on this side
        select mp.user_id into scorer_id
        from public.match_participants mp
        left join public.user_sports us on us.user_id = mp.user_id and us.sport_id = 2
        where mp.match_id = m_rec.id
          and mp.side = side_letter
          and mp.attendance = 'attended'
          and coalesce(us.preferred_position, 'med') <> 'gr'
        order by random()
        limit 1;

        if scorer_id is not null then
          update public.match_participants
          set goals = goals + 1
          where match_id = m_rec.id and user_id = scorer_id;

          -- 60% chance of an assist from a different non-GK teammate
          if random() < 0.6 then
            select mp.user_id into assister_id
            from public.match_participants mp
            left join public.user_sports us on us.user_id = mp.user_id and us.sport_id = 2
            where mp.match_id = m_rec.id
              and mp.side = side_letter
              and mp.attendance = 'attended'
              and mp.user_id <> scorer_id
              and coalesce(us.preferred_position, 'med') <> 'gr'
            order by random()
            limit 1;

            if assister_id is not null then
              update public.match_participants
              set assists = assists + 1
              where match_id = m_rec.id and user_id = assister_id;
            end if;
          end if;
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- Verify
select
  m.id,
  m.location_name,
  m.final_score_a || '-' || m.final_score_b as score,
  (select sum(goals) from match_participants where match_id = m.id and side = 'A') as goals_a,
  (select sum(goals) from match_participants where match_id = m.id and side = 'B') as goals_b,
  (select sum(assists) from match_participants where match_id = m.id) as assists_total
from matches m
where m.status = 'validated'
order by m.scheduled_at desc;
