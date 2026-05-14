-- =============================================================================
-- PLAYER REPORT THRESHOLDS — warning at 1 match, suspend at 2
-- =============================================================================
-- Extends user_reports with match context so we can apply José's rule:
--   1º jogo em que é reportado → aviso ao jogador
--   2º jogo distinto → conta suspensa
-- Reports without match_id (legacy / from profile) continue to work but
-- não contam para o threshold automático (revisão manual).

alter table public.user_reports
  add column if not exists match_id uuid references public.matches(id) on delete set null;

create index if not exists idx_user_reports_match on public.user_reports(match_id);

-- Mesmo reporter não pode reportar mesma pessoa duas vezes no mesmo jogo
create unique index if not exists ux_user_reports_one_per_match
  on public.user_reports(reporter_id, reported_id, match_id)
  where match_id is not null;

alter table public.profiles
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists warning_pending boolean not null default false,
  add column if not exists warning_acknowledged_at timestamptz,
  add column if not exists reported_match_count int not null default 0;

create or replace function public.tg_user_reports_apply_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if new.match_id is null then
    return new;
  end if;

  select count(distinct match_id) into v_count
  from public.user_reports
  where reported_id = new.reported_id
    and match_id is not null;

  update public.profiles
  set
    reported_match_count = v_count,
    is_suspended = case when v_count >= 2 then true else is_suspended end,
    suspended_at = case
      when v_count >= 2 and suspended_at is null then now()
      else suspended_at
    end,
    warning_pending = case
      when v_count >= 2 then false
      when v_count = 1 and warning_acknowledged_at is null then true
      else warning_pending
    end
  where id = new.reported_id;

  return new;
end;
$$;

drop trigger if exists trg_user_reports_threshold on public.user_reports;
create trigger trg_user_reports_threshold
  after insert on public.user_reports
  for each row execute function public.tg_user_reports_apply_threshold();

-- Backfill counts para reports antigos com match_id (caso existam)
update public.profiles p
set
  reported_match_count = c.cnt,
  is_suspended = case when c.cnt >= 2 then true else p.is_suspended end,
  suspended_at = case
    when c.cnt >= 2 and p.suspended_at is null then now()
    else p.suspended_at
  end,
  warning_pending = case
    when c.cnt = 1 and p.warning_acknowledged_at is null then true
    else p.warning_pending
  end
from (
  select reported_id, count(distinct match_id) as cnt
  from public.user_reports
  where match_id is not null
  group by reported_id
) c
where c.reported_id = p.id;

-- RPC: reportar jogador no contexto de um jogo (valida participação)
create or replace function public.report_player_in_match(
  p_match_id uuid,
  p_reported_id uuid,
  p_reason text,
  p_details text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_reporter_in bool;
  v_reported_in bool;
  v_id uuid;
begin
  if v_me is null then raise exception 'Sem sessão'; end if;
  if v_me = p_reported_id then raise exception 'Não te podes reportar a ti próprio'; end if;

  select exists(
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = v_me
  ) into v_reporter_in;
  select exists(
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = p_reported_id
  ) into v_reported_in;

  if not v_reporter_in then raise exception 'Não participaste neste jogo'; end if;
  if not v_reported_in then raise exception 'O jogador não participou neste jogo'; end if;

  insert into public.user_reports (reporter_id, reported_id, reason, details, match_id)
  values (v_me, p_reported_id, p_reason, p_details, p_match_id)
  returning id into v_id;

  return v_id;
exception when unique_violation then
  raise exception 'Já reportaste este jogador neste jogo';
end;
$$;

grant execute on function public.report_player_in_match(uuid, uuid, text, text) to authenticated;

-- RPC: jogador reconhece o aviso (dismiss do modal)
create or replace function public.acknowledge_warning()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Sem sessão'; end if;
  update public.profiles
  set warning_pending = false,
      warning_acknowledged_at = now()
  where id = v_me;
end;
$$;

grant execute on function public.acknowledge_warning() to authenticated;
