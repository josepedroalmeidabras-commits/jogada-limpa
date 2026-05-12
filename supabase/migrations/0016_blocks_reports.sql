-- =============================================================================
-- BLOCKED USERS + USER REPORTS
-- =============================================================================
-- Allow users to block other users (mutual hiding in market/free agents)
-- and report users for misconduct.

create table if not exists public.blocked_users (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  reason      text,
  created_at  timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_blocked_users_blocker on public.blocked_users(blocker_id);
create index if not exists idx_blocked_users_blocked on public.blocked_users(blocked_id);

alter table public.blocked_users enable row level security;

create policy "blocks_own_select"
  on public.blocked_users for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

create policy "blocks_own_insert"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

create policy "blocks_own_delete"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);


create table if not exists public.user_reports (
  id           uuid primary key default uuid_generate_v4(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  reported_id  uuid not null references public.profiles(id) on delete cascade,
  reason       text not null,
  details      text,
  status       text default 'pending' check (status in ('pending','resolved_no_action','resolved_warned','resolved_suspended')),
  resolved_by  uuid references public.profiles(id),
  resolved_at  timestamptz,
  created_at   timestamptz default now(),
  check (reporter_id <> reported_id)
);

create index if not exists idx_user_reports_reported on public.user_reports(reported_id);
create index if not exists idx_user_reports_status on public.user_reports(status);

alter table public.user_reports enable row level security;

-- Users can create reports and see their own; admins read all via service role.
create policy "reports_own_insert"
  on public.user_reports for insert
  with check (auth.uid() = reporter_id);

create policy "reports_own_select"
  on public.user_reports for select
  using (auth.uid() = reporter_id);
