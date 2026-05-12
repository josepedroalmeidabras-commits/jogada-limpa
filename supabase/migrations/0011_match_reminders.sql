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
