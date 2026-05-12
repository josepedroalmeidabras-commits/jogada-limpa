-- =============================================================================
-- Jogada Limpa — Migrations PENDENTES (0011 → 0021)
-- =============================================================================
-- Estado verificado via REST API em 2026-05-12:
--   ✓ Corridas: 0001, 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010
--   ✗ Falta:    0011, 0012, 0013, 0014, 0015, 0016, 0017, 0018, 0019, 0020, 0021
--
-- Como correr: cola tudo isto no SQL Editor (https://supabase.com/dashboard/
-- project/pcdxfwprsenpztpbgspy/sql/new) e clica em Run. Deve correr de uma só
-- vez sem erros.
-- =============================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0011_match_reminders.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- Reminders automáticos 24h e 2h antes do jogo — pg_cron + pg_net
-- =============================================================================
-- NOTAS:
-- 1) pg_cron e pg_net costumam estar disponíveis no Supabase, mas podem
--    precisar de ser ativados manualmente em "Database > Extensions" do
--    dashboard. Os CREATE EXTENSION abaixo não dão erro se já existirem.
-- 2) Tolerância de janela: 30 min. Se um cron run falhar, o seguinte
--    apanha matches que ainda estejam dentro da janela.
-- 3) Sem idempotência sofisticada — duplicados raros são preferíveis a
--    notificações perdidas em MVP.

create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- Helper: envia push via Expo Push API (assíncrono, fire-and-forget).
create or replace function public.send_push_via_net(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_data    jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  for v_token in
    select token from public.push_tokens where user_id = p_user_id
  loop
    perform net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'to',       v_token,
        'title',    p_title,
        'body',     p_body,
        'data',     p_data,
        'sound',    'default',
        'priority', 'high'
      )
    );
  end loop;
end;
$$;

revoke all on function public.send_push_via_net(uuid, text, text, jsonb)
  from public, anon, authenticated;

-- Reminder dispatcher: 24h e 2h windows.
create or replace function public.dispatch_match_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match       record;
  v_participant record;
  v_title       text;
begin
  for v_match in
    select
      m.id,
      m.scheduled_at,
      ta.name as a_name,
      tb.name as b_name,
      case
        when m.scheduled_at between now() + interval '23 hours 30 minutes'
                                and now() + interval '24 hours 30 minutes'
          then '24h'
        when m.scheduled_at between now() + interval '1 hour 30 minutes'
                                and now() + interval '2 hours 30 minutes'
          then '2h'
        else null
      end as window_label
    from public.matches m
    join public.match_sides sa on sa.match_id = m.id and sa.side = 'A'
    join public.match_sides sb on sb.match_id = m.id and sb.side = 'B'
    join public.teams ta on ta.id = sa.team_id
    join public.teams tb on tb.id = sb.team_id
    where m.status = 'confirmed'
  loop
    if v_match.window_label is null then
      continue;
    end if;

    v_title := case v_match.window_label
      when '24h' then 'Jogo amanhã ⚽'
      else            'Jogo daqui a 2h ⏰'
    end;

    for v_participant in
      select mp.user_id
        from public.match_participants mp
        where mp.match_id = v_match.id
          and mp.invitation_status = 'accepted'
    loop
      perform public.send_push_via_net(
        v_participant.user_id,
        v_title,
        v_match.a_name || ' vs ' || v_match.b_name,
        jsonb_build_object('match_id', v_match.id, 'window', v_match.window_label)
      );
    end loop;
  end loop;
end;
$$;

revoke all on function public.dispatch_match_reminders() from public, anon, authenticated;

-- Agendar a cada hora (à minuto 0). Se o nome já existir, recria.
select cron.unschedule('dispatch-match-reminders')
  where exists (select 1 from cron.job where jobname = 'dispatch-match-reminders');

select cron.schedule(
  'dispatch-match-reminders',
  '0 * * * *',
  $$ select public.dispatch_match_reminders(); $$
);


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0012_mvp_votes.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- MVP voting: cada participante de um match validated vota 1 colega
-- =============================================================================
-- Regras:
--  * Votar = INSERT em match_mvp_votes (match_id, voter_id, mvp_user_id).
--  * Voter tem de ter sido participante COM presença ('attended' / 'substitute_in').
--  * Voto único por (match_id, voter_id). Para mudar, terias de DELETE + INSERT.
--  * Match tem de estar 'validated'.
--  * mvp_user_id pode ser de qualquer lado (votas em colegas OU adversários).

create table public.match_mvp_votes (
  match_id     uuid not null references public.matches(id) on delete cascade,
  voter_id     uuid not null references public.profiles(id) on delete cascade,
  mvp_user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (match_id, voter_id),
  check (voter_id <> mvp_user_id)
);

create index idx_mvp_votes_mvp on public.match_mvp_votes(mvp_user_id);
create index idx_mvp_votes_match on public.match_mvp_votes(match_id);

alter table public.match_mvp_votes enable row level security;

-- Voter pode escrever só o seu voto, se cumprir critérios
create policy "mvp_votes_insert"
  on public.match_mvp_votes for insert to authenticated
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.status = 'validated'
    )
    and exists (
      select 1 from public.match_participants mp
      where mp.match_id = match_mvp_votes.match_id
        and mp.user_id = auth.uid()
        and mp.attendance in ('attended','substitute_in')
    )
  );

-- Voter pode ler/eliminar o próprio voto; todos podem ler agregados via view
create policy "mvp_votes_select_own"
  on public.match_mvp_votes for select to authenticated
  using (auth.uid() = voter_id);

create policy "mvp_votes_delete_own"
  on public.match_mvp_votes for delete to authenticated
  using (auth.uid() = voter_id);

-- View agregada com total de votos por user (pública)
create or replace view public.mvp_totals as
select
  mvp_user_id as user_id,
  count(*)::int as mvp_votes
from public.match_mvp_votes
group by mvp_user_id;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0013_free_agents.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- Mercado livre — jogadores disponíveis para entrar numa equipa
-- =============================================================================
-- Diferença de is_open_to_sub:
--   * is_open_to_sub = "aceito ser convidado para um jogo pontual"
--   * is_open_to_team = "quero juntar-me a uma equipa permanente"
-- Ambos coexistem na mesma row de user_sports.

alter table public.user_sports
  add column if not exists is_open_to_team    boolean default false,
  add column if not exists open_to_team_until timestamptz;

create index if not exists idx_user_sports_open_team
  on public.user_sports(sport_id, is_open_to_team)
  where is_open_to_team;

-- =============================================================================
-- invite_free_agent: capitão adiciona free agent à sua equipa.
-- Bypass RLS via SECURITY DEFINER porque team_members tem policy
-- "tm_join" que só permite auth.uid() = user_id (o próprio).
-- =============================================================================
create or replace function public.invite_free_agent(
  p_team_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_captain  uuid := auth.uid();
  v_team     public.teams%rowtype;
begin
  if v_captain is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_team
    from public.teams
    where id = p_team_id and is_active;
  if not found then
    raise exception 'Equipa não encontrada';
  end if;

  if v_team.captain_id <> v_captain then
    raise exception 'Só o capitão pode adicionar membros';
  end if;

  -- target tem de estar disponível para este desporto
  if not exists (
    select 1 from public.user_sports us
    where us.user_id  = p_user_id
      and us.sport_id = v_team.sport_id
      and us.is_open_to_team
      and (us.open_to_team_until is null or us.open_to_team_until > now())
  ) then
    raise exception 'Este jogador não está disponível para esta equipa';
  end if;

  -- adicionar (idempotente)
  insert into public.team_members(team_id, user_id, role)
    values (p_team_id, p_user_id, 'member')
    on conflict (team_id, user_id) do nothing;

  -- entrou numa equipa → fecha a disponibilidade para esse desporto
  update public.user_sports
    set is_open_to_team    = false,
        open_to_team_until = null
    where user_id  = p_user_id
      and sport_id = v_team.sport_id;
end;
$$;

revoke all on function public.invite_free_agent(uuid, uuid)
  from public, anon;
grant execute on function public.invite_free_agent(uuid, uuid) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0014_team_chat.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- Chat por equipa — só membros leem/escrevem; tempo real via supabase_realtime
-- =============================================================================

create table public.team_messages (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references public.teams(id)    on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz default now()
);

create index idx_team_messages_team_created
  on public.team_messages(team_id, created_at desc);

alter table public.team_messages enable row level security;

-- Membros lêem
create policy "team_msg_read"
  on public.team_messages for select to authenticated
  using (
    exists (
      select 1 from public.team_members
      where team_id = team_messages.team_id and user_id = auth.uid()
    )
  );

-- Membros escrevem
create policy "team_msg_insert"
  on public.team_messages for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.team_members
      where team_id = team_messages.team_id and user_id = auth.uid()
    )
  );

-- Autor ou capitão da equipa pode apagar
create policy "team_msg_delete"
  on public.team_messages for delete to authenticated
  using (
    auth.uid() = author_id
    or auth.uid() = (select captain_id from public.teams where id = team_messages.team_id)
  );

-- Activar realtime para esta tabela
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_messages'
  ) then
    alter publication supabase_realtime add table public.team_messages;
  end if;
end $$;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0015_notifications_insert.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- Permitir que qualquer authenticated user escreva na caixa de outro (push fan-out)
-- =============================================================================
-- Compromisso pragmático: o mesmo argumento usado para push_tokens.read.
-- A alternativa "limpa" seria um SECURITY DEFINER por cada tipo de evento;
-- para a Fase 1 com pool fechado de utilizadores, este é aceitável.

create policy "notif_insert_authenticated"
  on public.notifications for insert to authenticated
  with check (true);


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0016_blocks_reports.sql
-- ──────────────────────────────────────────────────────────────────────────

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


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0017_cancel_reschedule_match.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- CANCEL + RESCHEDULE CONFIRMED MATCHES
-- =============================================================================
-- Captains can cancel or reschedule a confirmed match before it is played.
-- Both notify the opposing captain.

alter table public.matches add column if not exists cancelled_at timestamptz;

-- ============================ cancel_confirmed_match ======================
create or replace function public.cancel_confirmed_match(
  p_match_id uuid,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_status    match_status;
  v_involved  boolean;
  v_match     record;
  v_opp_capt  uuid;
  v_my_team   text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Cancellation reason required';
  end if;

  select id, status, scheduled_at into v_match
    from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;
  v_status := v_match.status;

  if v_status not in ('confirmed', 'result_pending') then
    raise exception 'Only confirmed or pending-result matches can be cancelled';
  end if;

  if v_match.scheduled_at is not null and v_match.scheduled_at < now() - interval '24 hours' then
    raise exception 'Cannot cancel a match older than 24h after kickoff';
  end if;

  -- captain must be on either side
  select exists(
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) into v_involved;
  if not v_involved then
    raise exception 'Only the involved captains can cancel';
  end if;

  -- opposing captain (the one that is not the canceller)
  select ms.captain_id, t.name
    into v_opp_capt, v_my_team
    from public.match_sides ms
    join public.teams t on t.id = ms.team_id
    where ms.match_id = p_match_id and ms.captain_id <> v_user
    limit 1;

  -- my team (for the notification body)
  select t.name into v_my_team
    from public.match_sides ms
    join public.teams t on t.id = ms.team_id
    where ms.match_id = p_match_id and ms.captain_id = v_user
    limit 1;

  update public.matches
    set status = 'cancelled',
        cancelled_reason = p_reason,
        cancelled_at = now()
    where id = p_match_id;

  if v_opp_capt is not null then
    insert into public.notifications(user_id, type, title, body, payload, channel)
    values (
      v_opp_capt,
      'match_cancelled',
      'Jogo cancelado',
      coalesce(v_my_team || ' cancelou: ' || p_reason, p_reason),
      jsonb_build_object('match_id', p_match_id::text, 'reason', p_reason),
      'in_app'
    );
  end if;
end;
$$;

revoke all on function public.cancel_confirmed_match(uuid, text) from public, anon;
grant execute on function public.cancel_confirmed_match(uuid, text) to authenticated;


-- ============================ reschedule_match ============================
create or replace function public.reschedule_match(
  p_match_id      uuid,
  p_scheduled_at  timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_status    match_status;
  v_involved  boolean;
  v_match     record;
  v_opp_capt  uuid;
  v_my_team   text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_scheduled_at is null then
    raise exception 'New date required';
  end if;
  if p_scheduled_at < now() then
    raise exception 'New date must be in the future';
  end if;

  select id, status, scheduled_at into v_match
    from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;
  v_status := v_match.status;

  if v_status not in ('proposed', 'confirmed') then
    raise exception 'Only proposed or confirmed matches can be rescheduled';
  end if;

  select exists(
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) into v_involved;
  if not v_involved then
    raise exception 'Only the involved captains can reschedule';
  end if;

  select ms.captain_id
    into v_opp_capt
    from public.match_sides ms
    where ms.match_id = p_match_id and ms.captain_id <> v_user
    limit 1;

  select t.name into v_my_team
    from public.match_sides ms
    join public.teams t on t.id = ms.team_id
    where ms.match_id = p_match_id and ms.captain_id = v_user
    limit 1;

  -- A reschedule on a confirmed match reverts to proposed so the other side re-accepts.
  update public.matches
    set scheduled_at = p_scheduled_at,
        status = case when v_status = 'confirmed' then 'proposed' else v_status end,
        proposed_by = v_user
    where id = p_match_id;

  -- If we reverted to proposed, ensure proposing side is set to canceller's side
  -- (handled implicitly via proposed_by)

  if v_opp_capt is not null then
    insert into public.notifications(user_id, type, title, body, payload, channel)
    values (
      v_opp_capt,
      'match_rescheduled',
      'Jogo remarcado',
      coalesce(v_my_team, 'Adversário') || ' propõe nova data: ' ||
        to_char(p_scheduled_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI'),
      jsonb_build_object('match_id', p_match_id::text, 'scheduled_at', p_scheduled_at),
      'in_app'
    );
  end if;
end;
$$;

revoke all on function public.reschedule_match(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_match(uuid, timestamptz) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0018_match_photos.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- MATCH PHOTOS
-- =============================================================================
-- Players who took part in a validated match can upload photos.
-- Public bucket so URLs can be shared without signed-URL gymnastics.

insert into storage.buckets (id, name, public)
values ('match-photos', 'match-photos', true)
on conflict (id) do nothing;

create table if not exists public.match_photos (
  id          uuid primary key default uuid_generate_v4(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  public_url  text not null,
  caption     text,
  created_at  timestamptz default now()
);

create index if not exists idx_match_photos_match on public.match_photos(match_id, created_at desc);
create index if not exists idx_match_photos_user on public.match_photos(user_id);

alter table public.match_photos enable row level security;

-- Read: anyone who can read the match itself can read its photos.
create policy "match_photos_select_match_visible"
  on public.match_photos for select
  using (
    exists (
      select 1
      from public.matches m
      join public.match_sides ms on ms.match_id = m.id
      join public.team_members tm on tm.team_id = ms.team_id
      where m.id = match_photos.match_id
        and tm.user_id = auth.uid()
    )
  );

-- Insert: must be a member of one of the participating teams AND match validated.
create policy "match_photos_insert_participant"
  on public.match_photos for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.matches m
      join public.match_sides ms on ms.match_id = m.id
      join public.team_members tm on tm.team_id = ms.team_id
      where m.id = match_photos.match_id
        and m.status = 'validated'
        and tm.user_id = auth.uid()
    )
  );

-- Delete: only the uploader can delete their own photo.
create policy "match_photos_delete_own"
  on public.match_photos for delete
  using (auth.uid() = user_id);


-- ------------- storage policies for match-photos bucket -----------------------
-- Path convention: <match_id>/<filename>
drop policy if exists "match_photo_insert_participant" on storage.objects;
drop policy if exists "match_photo_delete_own"        on storage.objects;
drop policy if exists "match_photo_select_member"     on storage.objects;

create policy "match_photo_insert_participant"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'match-photos'
    and exists (
      select 1
      from public.matches m
      join public.match_sides ms on ms.match_id = m.id
      join public.team_members tm on tm.team_id = ms.team_id
      where m.id::text = (storage.foldername(name))[1]
        and m.status = 'validated'
        and tm.user_id = auth.uid()
    )
  );

create policy "match_photo_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'match-photos'
    and owner = auth.uid()
  );


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0019_team_chat_reads.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- TEAM CHAT READ RECEIPTS
-- =============================================================================
-- Per-user marker of the last time they opened a team's chat. Lets us derive
-- an unread count by comparing against team_messages.created_at.

create table if not exists public.team_chat_reads (
  team_id      uuid not null references public.teams(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.team_chat_reads enable row level security;

create policy "team_chat_reads_select_own"
  on public.team_chat_reads for select
  using (auth.uid() = user_id);

create policy "team_chat_reads_upsert_own"
  on public.team_chat_reads for insert
  with check (auth.uid() = user_id);

create policy "team_chat_reads_update_own"
  on public.team_chat_reads for update
  using (auth.uid() = user_id);


-- helper: bump my last_read_at for a team
create or replace function public.mark_team_chat_read(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- must be member of team
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = v_user
  ) then
    raise exception 'Not a member of this team';
  end if;

  insert into public.team_chat_reads(team_id, user_id, last_read_at)
  values (p_team_id, v_user, now())
  on conflict (team_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_team_chat_read(uuid) from public, anon;
grant execute on function public.mark_team_chat_read(uuid) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0020_match_notes.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- MATCH NOTES (kit colour, what to bring, etc.)
-- =============================================================================
-- Optional free-text note set by either captain. Distinct from `message`
-- (which is the proposal pitch). Visible to both teams once the match exists.

alter table public.matches
  add column if not exists notes text;

-- Drop the older 6-arg propose_match overload before redefining with 7 args.
drop function if exists public.propose_match(uuid, uuid, timestamptz, text, boolean, text);

-- Update RPC: allow proposing captain to set initial notes.
create or replace function public.propose_match(
  p_proposing_team_id uuid,
  p_opponent_team_id  uuid,
  p_scheduled_at      timestamptz,
  p_location_name     text default null,
  p_location_tbd      boolean default false,
  p_message           text default null,
  p_notes             text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposer       uuid := auth.uid();
  v_proposing_team record;
  v_opponent_team  record;
  v_match_id       uuid;
begin
  if v_proposer is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_proposing_team
    from public.teams
   where id = p_proposing_team_id and is_active;
  if not found then
    raise exception 'Proposing team not found';
  end if;

  if v_proposing_team.captain_id <> v_proposer then
    raise exception 'Only the team captain can propose';
  end if;

  select * into v_opponent_team
    from public.teams
   where id = p_opponent_team_id and is_active;
  if not found then
    raise exception 'Opponent team not found';
  end if;

  if v_proposing_team.sport_id <> v_opponent_team.sport_id then
    raise exception 'Teams must play the same sport';
  end if;

  insert into public.matches(
    sport_id, scheduled_at, location_name, location_tbd,
    status, proposed_by, message, notes
  )
  values (
    v_proposing_team.sport_id, p_scheduled_at, p_location_name, coalesce(p_location_tbd, false),
    'proposed', v_proposer, p_message, p_notes
  )
  returning id into v_match_id;

  insert into public.match_sides(match_id, side, team_id, captain_id) values
    (v_match_id, 'A', p_proposing_team_id, v_proposing_team.captain_id),
    (v_match_id, 'B', p_opponent_team_id,  v_opponent_team.captain_id);

  return v_match_id;
end;
$$;

revoke all on function public.propose_match(uuid, uuid, timestamptz, text, boolean, text, text)
  from public, anon;
grant execute on function public.propose_match(uuid, uuid, timestamptz, text, boolean, text, text)
  to authenticated;


-- Captains of either team can update notes on a non-validated match.
create or replace function public.update_match_notes(
  p_match_id uuid,
  p_notes    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_involved boolean;
  v_status   match_status;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;
  if v_status in ('validated', 'cancelled') then
    raise exception 'Match notes are locked';
  end if;

  select exists(
    select 1 from public.match_sides
    where match_id = p_match_id and captain_id = v_user
  ) into v_involved;
  if not v_involved then
    raise exception 'Only the involved captains can update notes';
  end if;

  update public.matches
    set notes = nullif(trim(p_notes), '')
    where id = p_match_id;
end;
$$;

revoke all on function public.update_match_notes(uuid, text) from public, anon;
grant execute on function public.update_match_notes(uuid, text) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FILE: 0021_match_chat.sql
-- ──────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- MATCH CHAT — shared chat across both teams of a match
-- =============================================================================
-- Auto-exists for every match. Any member of either participating team can
-- read and write. Captains of either team (or message author) can delete.

create table if not exists public.match_messages (
  id         uuid primary key default uuid_generate_v4(),
  match_id   uuid not null references public.matches(id)   on delete cascade,
  author_id  uuid not null references public.profiles(id)  on delete cascade,
  text       text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz default now()
);

create index if not exists idx_match_messages_match_created
  on public.match_messages(match_id, created_at desc);

alter table public.match_messages enable row level security;

-- A member of either team can read.
create policy "match_msg_read"
  on public.match_messages for select to authenticated
  using (
    exists (
      select 1
      from public.match_sides ms
      join public.team_members tm on tm.team_id = ms.team_id
      where ms.match_id = match_messages.match_id
        and tm.user_id = auth.uid()
    )
  );

-- A member of either team can write (as themselves).
create policy "match_msg_insert"
  on public.match_messages for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1
      from public.match_sides ms
      join public.team_members tm on tm.team_id = ms.team_id
      where ms.match_id = match_messages.match_id
        and tm.user_id = auth.uid()
    )
  );

-- Author or either captain of the match can delete.
create policy "match_msg_delete"
  on public.match_messages for delete to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1
      from public.match_sides ms
      where ms.match_id = match_messages.match_id
        and ms.captain_id = auth.uid()
    )
  );

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_messages'
  ) then
    alter publication supabase_realtime add table public.match_messages;
  end if;
end $$;


-- ============================ match_chat_reads =============================
-- Per-user marker of the last time they opened a match's chat.

create table if not exists public.match_chat_reads (
  match_id     uuid not null references public.matches(id)   on delete cascade,
  user_id      uuid not null references public.profiles(id)  on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.match_chat_reads enable row level security;

create policy "match_chat_reads_select_own"
  on public.match_chat_reads for select
  using (auth.uid() = user_id);

create policy "match_chat_reads_upsert_own"
  on public.match_chat_reads for insert
  with check (auth.uid() = user_id);

create policy "match_chat_reads_update_own"
  on public.match_chat_reads for update
  using (auth.uid() = user_id);


create or replace function public.mark_match_chat_read(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- must be a member of one of the teams
  if not exists (
    select 1
    from public.match_sides ms
    join public.team_members tm on tm.team_id = ms.team_id
    where ms.match_id = p_match_id and tm.user_id = v_user
  ) then
    raise exception 'Not a participant of this match';
  end if;

  insert into public.match_chat_reads(match_id, user_id, last_read_at)
  values (p_match_id, v_user, now())
  on conflict (match_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_match_chat_read(uuid) from public, anon;
grant execute on function public.mark_match_chat_read(uuid) to authenticated;
