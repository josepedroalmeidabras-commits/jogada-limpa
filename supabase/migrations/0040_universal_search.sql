-- =============================================================================
-- UNIVERSAL SEARCH (profiles + teams)
-- =============================================================================
-- Wrapper que devolve perfis e equipas num único call, ordenado por
-- relevância simples (nome bate antes de cidade). Filtra block/inactive.

create or replace function public.search_all(
  p_query text,
  p_limit int default 20
)
returns table (
  kind      text,
  id        uuid,
  name      text,
  photo_url text,
  city      text,
  meta      text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
  v_q    text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  v_q := trim(coalesce(p_query, ''));
  if char_length(v_q) < 2 then return; end if;
  v_q := '%' || v_q || '%';

  return query
    (
      select
        'profile'::text as kind,
        p.id,
        p.name,
        p.photo_url,
        p.city,
        coalesce(p.bio, '')::text as meta
      from public.profiles p
      where p.deleted_at is null
        and p.id <> v_user
        and (p.name ilike v_q or p.city ilike v_q)
        and not exists (
          select 1 from public.blocked_users b
          where (b.blocker_id = v_user and b.blocked_id = p.id)
             or (b.blocker_id = p.id and b.blocked_id = v_user)
        )
      order by case when p.name ilike v_q then 0 else 1 end, p.name
      limit p_limit
    )
    union all
    (
      select
        'team'::text as kind,
        t.id,
        t.name,
        t.photo_url,
        t.city,
        coalesce(t.description, '')::text as meta
      from public.teams t
      where t.is_active
        and (t.name ilike v_q or t.city ilike v_q)
      order by case when t.name ilike v_q then 0 else 1 end, t.name
      limit p_limit
    );
end;
$$;

revoke all on function public.search_all(text, int) from public, anon;
grant execute on function public.search_all(text, int) to authenticated;
