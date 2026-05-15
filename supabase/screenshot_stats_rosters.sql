-- =============================================================================
-- Screenshot polish: player stats + expanded rosters
-- =============================================================================
-- Idempotent. Run repeatedly without errors.

-- ----------------------------------------------------------------------------
-- 1. ROSTERS — push all fakes into all teams (≥14 members each)
-- ----------------------------------------------------------------------------
insert into public.team_members (team_id, user_id, role)
select t.id, p.id, 'member'
from public.teams t
cross join public.profiles p
where p.id::text like 'aaaaaaaa-0001-4000-8000-%'
  and p.deleted_at is null
on conflict (team_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. PLAYER STATS — position-aware votes for every fake, with multiple voters
-- ----------------------------------------------------------------------------
do $$
declare
  target_rec record;
  voter_rec record;
  base_pace int;
  base_shoot int;
  base_drib int;
  base_pass int;
  base_def int;
  base_phy int;
begin
  for target_rec in
    select p.id, coalesce(us.preferred_position, 'med') as pos
    from public.profiles p
    left join public.user_sports us on us.user_id = p.id and us.sport_id = 2
    where p.id::text like 'aaaaaaaa-0001-4000-8000-%'
      and p.deleted_at is null
  loop
    case target_rec.pos
      when 'gr'  then base_pace := 50; base_shoot := 35; base_drib := 40; base_pass := 55; base_def := 78; base_phy := 75;
      when 'def' then base_pace := 64; base_shoot := 55; base_drib := 58; base_pass := 68; base_def := 80; base_phy := 78;
      when 'med' then base_pace := 72; base_shoot := 70; base_drib := 76; base_pass := 82; base_def := 62; base_phy := 70;
      when 'ata' then base_pace := 82; base_shoot := 84; base_drib := 80; base_pass := 66; base_def := 50; base_phy := 72;
      else            base_pace := 68; base_shoot := 65; base_drib := 68; base_pass := 68; base_def := 62; base_phy := 68;
    end case;

    -- Self-vote (anchors the mean to the position baseline)
    insert into public.player_stat_votes (voter_id, target_id, category, value) values
      (target_rec.id, target_rec.id, 'velocidade', base_pace),
      (target_rec.id, target_rec.id, 'remate',     base_shoot),
      (target_rec.id, target_rec.id, 'drible',     base_drib),
      (target_rec.id, target_rec.id, 'passe',      base_pass),
      (target_rec.id, target_rec.id, 'defesa',     base_def),
      (target_rec.id, target_rec.id, 'fisico',     base_phy)
    on conflict do nothing;

    -- 4 teammate votes (small variance, average looks natural)
    for voter_rec in
      select p.id from public.profiles p
      where p.id::text like 'aaaaaaaa-0001-4000-8000-%'
        and p.id <> target_rec.id
        and p.deleted_at is null
      order by random()
      limit 4
    loop
      insert into public.player_stat_votes (voter_id, target_id, category, value) values
        (voter_rec.id, target_rec.id, 'velocidade', greatest(1, least(99, base_pace  + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'remate',     greatest(1, least(99, base_shoot + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'drible',     greatest(1, least(99, base_drib  + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'passe',      greatest(1, least(99, base_pass  + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'defesa',     greatest(1, least(99, base_def   + (random() * 10 - 5)::int))),
        (voter_rec.id, target_rec.id, 'fisico',     greatest(1, least(99, base_phy   + (random() * 10 - 5)::int)))
      on conflict do nothing;
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. VERIFY
-- ----------------------------------------------------------------------------
select
  (select count(*) from team_members) as memberships_total,
  (select count(distinct team_id) from team_members) as teams_with_members,
  (select min(c) from (select count(*) c from team_members group by team_id) z) as min_team_size,
  (select max(c) from (select count(*) c from team_members group by team_id) z) as max_team_size,
  (select count(*) from player_stat_votes) as stat_votes_total,
  (select count(distinct target_id) from player_stat_votes) as players_with_stats;
