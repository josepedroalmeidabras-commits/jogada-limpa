-- =============================================================================
-- Jogada Limpa — initial schema (MVP)
-- =============================================================================
-- Decisões refletidas:
--   * +18 only (check em birthdate)
--   * Reviews bilaterais ocultas com comentários moderados anonimamente
--   * ELO por jogador (K-factor adaptativo)
--   * Slot "à procura de jogador" (open_slots)
--   * Disputas de resultado moderadas manualmente
--   * MVP só futebol (F5/F7/F11); padel fica no schema mas inativo no UI
-- =============================================================================

-- ----------- EXTENSIONS -----------
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- ----------- ENUMS -----------
create type side as enum ('A','B');
create type team_role as enum ('captain','member');
create type match_status as enum (
  'proposed','confirmed','result_pending',
  'validated','disputed','cancelled'
);
create type invitation_status as enum ('pending','accepted','declined');
create type attendance as enum (
  'attended','missed','substitute_in','substitute_out'
);
create type review_role as enum ('opponent','teammate');
create type moderation_status as enum ('pending','approved','rejected');

-- ----------- PROFILES -----------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  photo_url     text,
  city          text not null default 'Coimbra',
  birthdate     date not null,
  phone         text,
  is_active     boolean default true,
  is_banned     boolean default false,
  banned_until  timestamptz,
  banned_reason text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint chk_age check (birthdate <= (now()::date - interval '18 years'))
);

-- ----------- SPORTS (lookup) -----------
create table public.sports (
  id                    serial primary key,
  code                  text unique not null,
  name                  text not null,
  format                text not null check (format in ('team','doubles')),
  team_size_min         int not null,
  team_size_max         int not null,
  default_duration_min  int not null,
  is_active             boolean default true
);

insert into public.sports (code, name, format, team_size_min, team_size_max, default_duration_min, is_active) values
  ('futebol5',  'Futebol 5',  'team',    5, 10, 60, true),
  ('futebol7',  'Futebol 7',  'team',    7, 12, 80, true),
  ('futebol11', 'Futebol 11', 'team',   11, 18, 90, true),
  ('padel',     'Padel',      'doubles', 2,  2, 75, false);  -- inativo no MVP

-- ----------- USER_SPORTS (perfil desportivo) -----------
create table public.user_sports (
  user_id            uuid references public.profiles(id) on delete cascade,
  sport_id           int  references public.sports(id),
  declared_level     int  check (declared_level between 1 and 10),
  elo                numeric(7,2) default 1200,
  matches_played     int default 0,
  is_open_to_sub     boolean default false,
  open_until         timestamptz,
  preferred_position text,
  created_at         timestamptz default now(),
  primary key (user_id, sport_id)
);

-- ----------- TEAMS -----------
create table public.teams (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  photo_url   text,
  sport_id    int not null references public.sports(id),
  city        text not null default 'Coimbra',
  captain_id  uuid not null references public.profiles(id),
  invite_code text unique default substr(md5(random()::text), 1, 8),
  is_active   boolean default true,
  created_at  timestamptz default now()
);

create table public.team_members (
  team_id   uuid references public.teams(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  role      team_role default 'member',
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);

-- ----------- MATCHES -----------
create table public.matches (
  id               uuid primary key default uuid_generate_v4(),
  sport_id         int not null references public.sports(id),
  scheduled_at     timestamptz not null,
  location_name    text,
  location_geo     geography(point),
  location_tbd     boolean default false,
  status           match_status default 'proposed',
  proposed_by      uuid not null references public.profiles(id),
  message          text,
  final_score_a    int,
  final_score_b    int,
  validated_at     timestamptz,
  dispute_notes    text,
  resolved_by      uuid references public.profiles(id),
  cancelled_reason text,
  created_at       timestamptz default now()
);

create table public.match_sides (
  match_id   uuid references public.matches(id) on delete cascade,
  side       side not null,
  team_id    uuid references public.teams(id),
  captain_id uuid not null references public.profiles(id),
  primary key (match_id, side)
);

create table public.match_participants (
  match_id          uuid references public.matches(id) on delete cascade,
  user_id           uuid references public.profiles(id) on delete cascade,
  side              side not null,
  invitation_status invitation_status default 'pending',
  attendance        attendance,
  invited_at        timestamptz default now(),
  responded_at      timestamptz,
  primary key (match_id, user_id)
);

create table public.open_slots (
  id              uuid primary key default uuid_generate_v4(),
  match_id        uuid references public.matches(id) on delete cascade,
  side            side not null,
  desired_elo_min numeric(7,2),
  desired_elo_max numeric(7,2),
  filled_by       uuid references public.profiles(id),
  filled_at       timestamptz,
  created_at      timestamptz default now()
);

create table public.match_score_submissions (
  match_id          uuid references public.matches(id) on delete cascade,
  submitted_by_side side not null,
  score_a           int not null check (score_a >= 0),
  score_b           int not null check (score_b >= 0),
  submitted_by      uuid not null references public.profiles(id),
  submitted_at      timestamptz default now(),
  primary key (match_id, submitted_by_side)
);

-- ----------- REVIEWS -----------
create table public.reviews (
  id                        uuid primary key default uuid_generate_v4(),
  match_id                  uuid not null references public.matches(id) on delete cascade,
  reviewer_id               uuid not null references public.profiles(id) on delete cascade,
  reviewed_id               uuid not null references public.profiles(id) on delete cascade,
  role                      review_role not null,
  fair_play                 int  not null check (fair_play between 1 and 5),
  punctuality               int  not null check (punctuality between 1 and 5),
  technical_level           int  not null check (technical_level between 1 and 5),
  attitude                  int  not null check (attitude between 1 and 5),
  comment                   text check (char_length(comment) <= 200),
  comment_moderation_status moderation_status default 'pending',
  comment_moderation_score  jsonb,
  submitted_at              timestamptz default now(),
  visible_at                timestamptz,
  unique (match_id, reviewer_id, reviewed_id),
  check (reviewer_id <> reviewed_id)
);

create table public.review_reports (
  id          uuid primary key default uuid_generate_v4(),
  review_id   uuid not null references public.reviews(id),
  reporter_id uuid not null references public.profiles(id),
  reason      text not null,
  status      text default 'pending' check (status in ('pending','resolved_kept','resolved_removed')),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at  timestamptz default now()
);

-- ----------- ELO HISTORY (audit log) -----------
create table public.elo_history (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id),
  sport_id   int  not null references public.sports(id),
  match_id   uuid not null references public.matches(id),
  elo_before numeric(7,2) not null,
  elo_after  numeric(7,2) not null,
  delta      numeric(7,2) generated always as (elo_after - elo_before) stored,
  created_at timestamptz default now()
);

-- ----------- NOTIFICATIONS -----------
create table public.notifications (
  id      uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type    text not null,
  title   text not null,
  body    text,
  payload jsonb,
  channel text not null check (channel in ('push','email','in_app')),
  read_at timestamptz,
  sent_at timestamptz default now()
);

create table public.notification_preferences (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  match_invite_push    boolean default true,
  match_invite_email   boolean default false,
  match_confirmed_push boolean default true,
  reminder_24h_push    boolean default true,
  reminder_2h_push     boolean default true,
  result_pending_push  boolean default true,
  result_pending_email boolean default true,
  review_pending_push  boolean default true,
  review_pending_email boolean default true,
  weekly_digest_email  boolean default true,
  marketing_email      boolean default false,
  quiet_hours_start    time default '23:00',
  quiet_hours_end      time default '08:00'
);

-- =============================================================================
-- INDEXES
-- =============================================================================
create index idx_teams_sport_city          on public.teams(sport_id, city) where is_active;
create index idx_matches_scheduled         on public.matches(scheduled_at);
create index idx_matches_status            on public.matches(status);
create index idx_matches_geo               on public.matches using gist(location_geo);
create index idx_user_sports_sport_elo     on public.user_sports(sport_id, elo);
create index idx_user_sports_open          on public.user_sports(sport_id, is_open_to_sub) where is_open_to_sub;
create index idx_reviews_reviewed          on public.reviews(reviewed_id);
create index idx_notifications_user_unread on public.notifications(user_id) where read_at is null;
create index idx_open_slots_unfilled       on public.open_slots(match_id, side) where filled_by is null;

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================
alter table public.profiles                 enable row level security;
alter table public.user_sports              enable row level security;
alter table public.teams                    enable row level security;
alter table public.team_members             enable row level security;
alter table public.matches                  enable row level security;
alter table public.match_sides              enable row level security;
alter table public.match_participants       enable row level security;
alter table public.open_slots               enable row level security;
alter table public.match_score_submissions  enable row level security;
alter table public.reviews                  enable row level security;
alter table public.review_reports           enable row level security;
alter table public.elo_history              enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;

-- PROFILES
create policy "profiles_read"   on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);

-- USER_SPORTS
create policy "user_sports_read" on public.user_sports for select using (true);
create policy "user_sports_own"  on public.user_sports for all    using (auth.uid() = user_id);

-- TEAMS
create policy "teams_read"   on public.teams for select using (true);
create policy "teams_create" on public.teams for insert with check (auth.uid() = captain_id);
create policy "teams_update" on public.teams for update using (auth.uid() = captain_id);

-- TEAM_MEMBERS
create policy "tm_read"  on public.team_members for select using (true);
create policy "tm_join"  on public.team_members for insert with check (auth.uid() = user_id);
create policy "tm_leave" on public.team_members for delete using (
  auth.uid() = user_id
  or auth.uid() = (select captain_id from public.teams where id = team_id)
);

-- MATCHES
create policy "matches_read"   on public.matches for select using (true);
create policy "matches_create" on public.matches for insert with check (auth.uid() = proposed_by);
create policy "matches_update" on public.matches for update using (
  auth.uid() in (select captain_id from public.match_sides where match_id = id)
);

-- MATCH_SIDES
create policy "ms_read" on public.match_sides for select using (true);
create policy "ms_own"  on public.match_sides for all using (auth.uid() = captain_id);

-- MATCH_PARTICIPANTS
create policy "mp_read"      on public.match_participants for select using (true);
create policy "mp_respond"   on public.match_participants for update using (auth.uid() = user_id);
create policy "mp_convocate" on public.match_participants for insert with check (
  auth.uid() in (
    select captain_id from public.match_sides
    where match_id = match_participants.match_id and side = match_participants.side
  )
);

-- SCORE SUBMISSIONS
create policy "scores_read"   on public.match_score_submissions for select using (true);
create policy "scores_submit" on public.match_score_submissions for insert with check (
  auth.uid() = submitted_by
  and auth.uid() = (
    select captain_id from public.match_sides
    where match_id = match_score_submissions.match_id
      and side = match_score_submissions.submitted_by_side
  )
);

-- REVIEWS (RLS estrita; agregação via VIEW abaixo)
create policy "reviews_own_read" on public.reviews for select using (auth.uid() = reviewer_id);
create policy "reviews_submit"   on public.reviews for insert with check (auth.uid() = reviewer_id);

-- ELO HISTORY
create policy "elo_read_own" on public.elo_history for select using (auth.uid() = user_id);

-- NOTIFICATIONS
create policy "notif_own"       on public.notifications for select using (auth.uid() = user_id);
create policy "notif_mark_read" on public.notifications for update using (auth.uid() = user_id);

-- PREFERENCES
create policy "prefs_own" on public.notification_preferences for all using (auth.uid() = user_id);

-- =============================================================================
-- VIEWS (exposição pública agregada — preserva anonimato dos reviewers)
-- =============================================================================
create view public.review_aggregates as
select
  reviewed_id            as user_id,
  count(*)               as total_reviews,
  avg(fair_play)         as avg_fair_play,
  avg(punctuality)       as avg_punctuality,
  avg(technical_level)   as avg_technical_level,
  avg(attitude)          as avg_attitude
from public.reviews
where comment_moderation_status <> 'rejected'
  and visible_at is not null
  and visible_at <= now()
group by reviewed_id;

create view public.review_comments_public as
select
  id,
  reviewed_id,
  match_id,
  comment,
  submitted_at
from public.reviews
where comment is not null
  and comment_moderation_status = 'approved'
  and visible_at is not null
  and visible_at <= now();

-- =============================================================================
-- FUNCTIONS + TRIGGERS
-- =============================================================================

-- K-factor adaptativo
create or replace function public.k_factor(matches_played int)
returns numeric language plpgsql immutable as $$
begin
  if matches_played < 10 then return 40;
  elsif matches_played < 30 then return 20;
  else return 10;
  end if;
end; $$;

-- Recalcula ELO de todos os participantes presentes
create or replace function public.calculate_match_elo(p_match_id uuid)
returns void language plpgsql as $$
declare
  v_sport_id int;
  v_score_a int; v_score_b int;
  v_avg_a numeric; v_avg_b numeric;
  v_exp_a numeric; v_exp_b numeric;
  v_act_a numeric; v_act_b numeric;
  v_p record;
  v_k numeric; v_new numeric;
begin
  select sport_id, final_score_a, final_score_b
    into v_sport_id, v_score_a, v_score_b
    from public.matches where id = p_match_id;

  if v_score_a > v_score_b then v_act_a := 1; v_act_b := 0;
  elsif v_score_a < v_score_b then v_act_a := 0; v_act_b := 1;
  else v_act_a := 0.5; v_act_b := 0.5;
  end if;

  select avg(us.elo) into v_avg_a
    from public.match_participants mp
    join public.user_sports us on us.user_id = mp.user_id and us.sport_id = v_sport_id
    where mp.match_id = p_match_id and mp.side = 'A'
      and mp.attendance in ('attended','substitute_in');

  select avg(us.elo) into v_avg_b
    from public.match_participants mp
    join public.user_sports us on us.user_id = mp.user_id and us.sport_id = v_sport_id
    where mp.match_id = p_match_id and mp.side = 'B'
      and mp.attendance in ('attended','substitute_in');

  v_exp_a := 1.0 / (1.0 + power(10, (v_avg_b - v_avg_a) / 400.0));
  v_exp_b := 1.0 - v_exp_a;

  for v_p in
    select mp.user_id, mp.side, us.elo, us.matches_played
      from public.match_participants mp
      join public.user_sports us on us.user_id = mp.user_id and us.sport_id = v_sport_id
      where mp.match_id = p_match_id
        and mp.attendance in ('attended','substitute_in')
  loop
    v_k := public.k_factor(v_p.matches_played);
    v_new := v_p.elo + v_k * (
      case when v_p.side = 'A' then (v_act_a - v_exp_a) else (v_act_b - v_exp_b) end
    );

    insert into public.elo_history(user_id, sport_id, match_id, elo_before, elo_after)
    values (v_p.user_id, v_sport_id, p_match_id, v_p.elo, v_new);

    update public.user_sports
      set elo = v_new,
          matches_played = matches_played + 1
      where user_id = v_p.user_id and sport_id = v_sport_id;
  end loop;
end; $$;

-- Trigger: ao validar match, calcula ELO
create or replace function public.tg_match_validated()
returns trigger language plpgsql as $$
begin
  if new.status = 'validated' and (old.status is distinct from 'validated') then
    perform public.calculate_match_elo(new.id);
    new.validated_at := now();
  end if;
  return new;
end; $$;

create trigger trg_match_validated
  before update on public.matches
  for each row execute function public.tg_match_validated();

-- Trigger: quando ambos os lados submetem scores
create or replace function public.tg_score_submitted()
returns trigger language plpgsql as $$
declare
  v_a record; v_b record;
begin
  select * into v_a from public.match_score_submissions
    where match_id = new.match_id and submitted_by_side = 'A';
  select * into v_b from public.match_score_submissions
    where match_id = new.match_id and submitted_by_side = 'B';

  if v_a is not null and v_b is not null then
    if v_a.score_a = v_b.score_a and v_a.score_b = v_b.score_b then
      update public.matches
        set final_score_a = v_a.score_a,
            final_score_b = v_a.score_b,
            status = 'validated'
        where id = new.match_id;
    else
      update public.matches set status = 'disputed' where id = new.match_id;
    end if;
  end if;
  return new;
end; $$;

create trigger trg_score_submitted
  after insert on public.match_score_submissions
  for each row execute function public.tg_score_submitted();

-- Trigger: ao submeter review, revela bilateral se recíproca existir; senão fallback 72h
create or replace function public.tg_review_submitted()
returns trigger language plpgsql as $$
declare
  v_reciprocal_id uuid;
begin
  select id into v_reciprocal_id
    from public.reviews
    where match_id = new.match_id
      and reviewer_id = new.reviewed_id
      and reviewed_id = new.reviewer_id;

  if v_reciprocal_id is not null then
    update public.reviews set visible_at = now() where id = v_reciprocal_id;
    new.visible_at := now();
  else
    new.visible_at := now() + interval '72 hours';
  end if;
  return new;
end; $$;

create trigger trg_review_submitted
  before insert on public.reviews
  for each row execute function public.tg_review_submitted();

-- Trigger: ao criar equipa, adiciona o capitão como membro
create or replace function public.tg_team_created()
returns trigger language plpgsql as $$
begin
  insert into public.team_members(team_id, user_id, role)
    values (new.id, new.captain_id, 'captain');
  return new;
end; $$;

create trigger trg_team_created
  after insert on public.teams
  for each row execute function public.tg_team_created();
