-- =============================================================================
-- WIPE SEED FAKES — remove all screenshot/test seed data before App Store launch
-- =============================================================================
-- The screenshot seeds (0029, 0036, 0066, 0068, screenshot_*) inserted fake
-- users (auth.users IDs a-0001 to a-0016, b-0001+ for matches etc) plus
-- generated player_stat_votes, team_members, match_participants for them.
--
-- This migration removes ALL of that so production launches with zero clutter
-- aside from real signups.

do $$
declare
  v_fake_users uuid[];
begin
  -- Collect every auth.users id that matches the seed pattern
  select array_agg(id) into v_fake_users
  from auth.users
  where email like '%@jogadalimpa.local'
     or id::text like 'aaaaaaaa-0001-4000-8000-%';

  if v_fake_users is null then
    raise notice 'No seed fakes found, nothing to wipe.';
    return;
  end if;

  raise notice 'Wiping % seeded fake users + their data.', array_length(v_fake_users, 1);

  -- 1. Delete fake matches first (cascades to participants, sides, score submissions, reviews, open_slots)
  delete from public.matches
  where id::text like 'cccccccc-0001-4000-8000-%'
     or proposed_by = any(v_fake_users);

  -- 2. Drop any remaining match_sides referencing fake teams (defensive — match_sides has no cascade on team_id)
  delete from public.match_sides
  where team_id in (
    select id from public.teams
    where id::text like 'bbbbbbbb-0001-4000-8000-%'
       or id::text like 'cccccccc-0001-4000-8000-%'
       or captain_id = any(v_fake_users)
  );

  -- 3. Delete fake teams (cascades team_members, etc.)
  delete from public.teams
  where id::text like 'bbbbbbbb-0001-4000-8000-%'
     or id::text like 'cccccccc-0001-4000-8000-%'
     or captain_id = any(v_fake_users);

  -- 4. Delete fake profiles (cascades user_sports, player_stat_votes, friendships, etc.)
  delete from public.profiles where id = any(v_fake_users);

  -- 5. Delete fake auth users
  delete from auth.users where id = any(v_fake_users);
end $$;

-- Verify post-wipe
select
  (select count(*) from auth.users where email like '%@jogadalimpa.local') as fake_auth_users_left,
  (select count(*) from profiles where id::text like 'aaaaaaaa-0001-4000-8000-%') as fake_profiles_left,
  (select count(*) from teams where id::text like 'bbbbbbbb-0001-4000-8000-%'
     or id::text like 'cccccccc-0001-4000-8000-%') as fake_teams_left,
  (select count(*) from matches where id::text like 'cccccccc-0001-4000-8000-%') as fake_matches_left,
  (select count(*) from profiles where deleted_at is null) as real_profiles_remaining,
  (select count(*) from teams) as real_teams_remaining;
