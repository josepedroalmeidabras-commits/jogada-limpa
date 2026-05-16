-- =============================================================================
-- 0087 — Fix auth para seed users do App Review (reviewer + 13 fakes)
-- =============================================================================
-- reviewer_seed.sql (commit 285f113) inseriu 14 users directamente em
-- auth.users mas:
--
--   a) Não criou os rows correspondentes em auth.identities. Desde GoTrue
--      v2, login por password requer identity explícita.
--
--   b) Não preencheu vários TEXT columns que o GoTrue Go-scan'a como
--      string não-nullable (`email_change`, `email_change_token_new`,
--      `email_change_token_current`, `recovery_token`, `confirmation_token`,
--      `reauthentication_token`, `phone_change`, `phone_change_token`).
--      Mesmo que a coluna seja NULL-permissiva no Postgres, o GoTrue
--      rejeita o row inteiro com 500 "Database error querying schema".
--
--   c) Não populou o array `providers:["email"]` em raw_app_meta_data.
--      GoTrue moderno valida essa chave durante login.
--
-- Resultado: /auth/v1/token devolvia 500 "Database error querying schema"
-- e bloqueou a App Review do build #4 (Guideline 2.1).
--
-- Esta migration corrige tudo. Idempotente.

-- ─── (a) Backfill identities ───────────────────────────────────────────────
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

-- ─── (b) Normaliza NULL → '' nos token columns ────────────────────────────
-- ─── (c) Garante providers:["email"] em raw_app_meta_data ─────────────────
update auth.users
set
  email_change               = coalesce(email_change,               ''),
  email_change_token_new     = coalesce(email_change_token_new,     ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  recovery_token             = coalesce(recovery_token,             ''),
  confirmation_token         = coalesce(confirmation_token,         ''),
  reauthentication_token     = coalesce(reauthentication_token,     ''),
  phone_change               = coalesce(phone_change,               ''),
  phone_change_token         = coalesce(phone_change_token,         ''),
  raw_app_meta_data = case
    when raw_app_meta_data ? 'providers' then raw_app_meta_data
    else jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
  end,
  updated_at = now()
where email = 'reviewer@s7vn.app' or email like '%@s7vn.local';

-- ─── Verificar ───────────────────────────────────────────────────────────
select
  (select count(*) from auth.users
     where email = 'reviewer@s7vn.app' or email like '%@s7vn.local')           as seed_users,
  (select count(*) from auth.identities i
     join auth.users u on u.id = i.user_id
     where i.provider = 'email'
       and (u.email = 'reviewer@s7vn.app' or u.email like '%@s7vn.local'))     as seed_identities,
  (select count(*) from auth.users
     where (email = 'reviewer@s7vn.app' or email like '%@s7vn.local')
       and email_change is not null and recovery_token is not null
       and confirmation_token is not null
       and raw_app_meta_data ? 'providers')                                    as seed_users_fully_normalized;
