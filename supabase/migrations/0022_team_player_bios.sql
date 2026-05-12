-- =============================================================================
-- TEAM DESCRIPTION + PLAYER BIO
-- =============================================================================
-- Optional free-text fields so teams and players can express personality.

alter table public.teams
  add column if not exists description text;

alter table public.profiles
  add column if not exists bio text;
