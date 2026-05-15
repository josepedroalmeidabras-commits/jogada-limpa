-- =============================================================================
-- Screenshot polish: 14+ players per match (7+ per side)
-- =============================================================================
-- Idempotent. Run repeatedly without errors.

do $$
declare
  m_rec record;
  s_rec record;
  p_rec record;
  needed int;
begin
  for m_rec in
    select id from public.matches where status = 'validated'
  loop
    for s_rec in
      select side, team_id from public.match_sides where match_id = m_rec.id
    loop
      -- How many MORE attended participants needed to reach 8 on this side
      select greatest(0, 8 - count(*))::int into needed
      from public.match_participants
      where match_id = m_rec.id
        and side = s_rec.side
        and attendance = 'attended';

      if needed > 0 then
        for p_rec in
          select tm.user_id
          from public.team_members tm
          where tm.team_id = s_rec.team_id
            and not exists (
              select 1 from public.match_participants mp
              where mp.match_id = m_rec.id and mp.user_id = tm.user_id
            )
          order by random()
          limit needed
        loop
          insert into public.match_participants
            (match_id, user_id, side, invitation_status, attendance)
          values
            (m_rec.id, p_rec.user_id, s_rec.side, 'accepted', 'attended')
          on conflict do nothing;
        end loop;
      end if;
    end loop;
  end loop;
end $$;

-- Verify: count attended players per match
select
  m.id,
  m.location_name,
  m.scheduled_at::date as date,
  (select count(*) from match_participants where match_id = m.id and side = 'A' and attendance = 'attended') as side_a,
  (select count(*) from match_participants where match_id = m.id and side = 'B' and attendance = 'attended') as side_b,
  (select count(*) from match_participants where match_id = m.id and attendance = 'attended') as total
from matches m
where m.status = 'validated'
order by m.scheduled_at desc;
