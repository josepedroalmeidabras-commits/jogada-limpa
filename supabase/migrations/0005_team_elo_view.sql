-- =============================================================================
-- View agregada com ELO médio e contagem de membros por equipa
-- =============================================================================
-- ELO médio = avg(user_sports.elo) dos membros, filtrado pelo desporto da equipa.
-- Membros sem registo em user_sports para esse desporto não contam para a média
-- (mas continuam contados como membros).

create or replace view public.team_elo as
select
  t.id        as team_id,
  t.sport_id,
  coalesce(avg(us.elo), 1200)::numeric(7,2) as elo_avg,
  count(distinct tm.user_id)::int           as member_count
from public.teams t
left join public.team_members tm on tm.team_id = t.id
left join public.user_sports  us on us.user_id = tm.user_id
                                and us.sport_id = t.sport_id
where t.is_active
group by t.id, t.sport_id;

comment on view public.team_elo is
  'Média de ELO dos membros + número de membros, por equipa.';
