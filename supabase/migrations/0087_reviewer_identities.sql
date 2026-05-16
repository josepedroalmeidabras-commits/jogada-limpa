-- =============================================================================
-- 0087 — Backfill auth.identities para seed users do App Review
-- =============================================================================
-- reviewer_seed.sql (commit 285f113) inseriu 14 users directamente em
-- auth.users mas não criou as identidades em auth.identities. Desde GoTrue
-- v2 (Supabase 2023+), o login por password faz JOIN com auth.identities
-- para resolver o provider — sem o row, /auth/v1/token devolve
--   500 unexpected_failure  "Database error querying schema"
-- que foi exactamente o que bloqueou a App Review (Guideline 2.1).
--
-- Esta migration cria a identity 'email' em falta para o reviewer + 13
-- fakes do seed. Idempotente (não duplica se já existir).

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub',            u.id::text,
    'email',          u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from auth.users u
where (u.email = 'reviewer@s7vn.app' or u.email like '%@s7vn.local')
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- Verificar
select
  (select count(*) from auth.users
     where email = 'reviewer@s7vn.app' or email like '%@s7vn.local')
    as seed_users,
  (select count(*) from auth.identities i
     join auth.users u on u.id = i.user_id
     where i.provider = 'email'
       and (u.email = 'reviewer@s7vn.app' or u.email like '%@s7vn.local'))
    as seed_identities;
