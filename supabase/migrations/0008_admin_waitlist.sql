-- =============================================================================
-- Admin: RPC para o founder ler a tabela waitlist
-- =============================================================================
-- waitlist tem RLS que bloqueia SELECT. Esta função SECURITY DEFINER deixa
-- apenas o admin (hard-coded por email) listar inscrições.

create or replace function public.get_waitlist()
returns table (
  id         uuid,
  email      text,
  city       text,
  source     text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then
    raise exception 'Not authenticated';
  end if;
  if v_email <> 'josepedroalmeidabras@gmail.com' then
    raise exception 'Not admin';
  end if;

  return query
    select w.id, w.email, w.city, w.source, w.created_at
    from public.waitlist w
    order by w.created_at desc;
end;
$$;

revoke all on function public.get_waitlist() from public, anon;
grant execute on function public.get_waitlist() to authenticated;
