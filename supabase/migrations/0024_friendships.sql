-- =============================================================================
-- FRIENDSHIPS (mutual, requires accept)
-- =============================================================================
-- Single row per pair, semantic columns (requester sent the request, addressee
-- received it). RPCs handle the state machine and enforce permissions.

create table if not exists public.friendships (
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  addressee_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null check (status in ('pending','accepted')),
  created_at    timestamptz default now(),
  accepted_at   timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists idx_friendships_requester on public.friendships(requester_id);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id);
create index if not exists idx_friendships_status    on public.friendships(status);

alter table public.friendships enable row level security;

-- See your own pending/accepted rows (either side)
create policy "friendships_select_involved"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);


-- ============================ send_friend_request ===========================
create or replace function public.send_friend_request(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_target_ok   boolean;
  v_already     text;
  v_blocked     boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if v_user = p_target_id then
    raise exception 'Cannot friend yourself';
  end if;

  -- target must exist and not be soft-deleted
  select exists(
    select 1 from public.profiles
    where id = p_target_id and deleted_at is null
  ) into v_target_ok;
  if not v_target_ok then
    raise exception 'Target user not found';
  end if;

  -- block check (either direction blocks the request)
  select exists(
    select 1 from public.blocked_users
    where (blocker_id = v_user and blocked_id = p_target_id)
       or (blocker_id = p_target_id and blocked_id = v_user)
  ) into v_blocked;
  if v_blocked then
    raise exception 'Cannot send friend request';
  end if;

  -- if a reverse pending request already exists, treat this as auto-accept
  if exists (
    select 1 from public.friendships
    where requester_id = p_target_id and addressee_id = v_user
      and status = 'pending'
  ) then
    update public.friendships
       set status = 'accepted', accepted_at = now()
     where requester_id = p_target_id and addressee_id = v_user;
    return;
  end if;

  -- if relationship already exists (any state), no-op
  if exists (
    select 1 from public.friendships
    where (requester_id = v_user and addressee_id = p_target_id)
       or (requester_id = p_target_id and addressee_id = v_user)
  ) then
    return;
  end if;

  insert into public.friendships(requester_id, addressee_id, status)
  values (v_user, p_target_id, 'pending');

  -- notify the addressee
  insert into public.notifications(user_id, type, title, body, payload, channel)
  select p_target_id,
         'friend_request',
         'Novo pedido de amizade',
         coalesce((select name from public.profiles where id = v_user) || ' enviou-te um pedido', 'Tens um novo pedido'),
         jsonb_build_object('from_id', v_user::text),
         'in_app';
end;
$$;

revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;


-- ============================ accept_friend_request =========================
create or replace function public.accept_friend_request(p_requester_id uuid)
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

  update public.friendships
     set status = 'accepted', accepted_at = now()
   where requester_id = p_requester_id
     and addressee_id = v_user
     and status = 'pending';

  if not found then
    raise exception 'No pending request from that user';
  end if;

  insert into public.notifications(user_id, type, title, body, payload, channel)
  select p_requester_id,
         'friend_accepted',
         'Pedido de amizade aceite',
         coalesce((select name from public.profiles where id = v_user) || ' aceitou o teu pedido', 'Tens um amigo novo'),
         jsonb_build_object('friend_id', v_user::text),
         'in_app';
end;
$$;

revoke all on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;


-- ============================ decline_friend_request ========================
create or replace function public.decline_friend_request(p_requester_id uuid)
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

  delete from public.friendships
   where requester_id = p_requester_id
     and addressee_id = v_user
     and status = 'pending';
end;
$$;

revoke all on function public.decline_friend_request(uuid) from public, anon;
grant execute on function public.decline_friend_request(uuid) to authenticated;


-- ============================ cancel_friend_request =========================
-- (Requester withdraws their own outgoing pending request.)
create or replace function public.cancel_friend_request(p_target_id uuid)
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

  delete from public.friendships
   where requester_id = v_user
     and addressee_id = p_target_id
     and status = 'pending';
end;
$$;

revoke all on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;


-- ============================ remove_friend =================================
create or replace function public.remove_friend(p_other_id uuid)
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

  delete from public.friendships
   where status = 'accepted'
     and ((requester_id = v_user and addressee_id = p_other_id)
       or (requester_id = p_other_id and addressee_id = v_user));
end;
$$;

revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;


-- =============================================================================
-- Broaden player-stat voting eligibility to include accepted friends
-- =============================================================================
create or replace function public.set_my_stat_vote(
  p_target_id uuid,
  p_category  text,
  p_value     smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_eligible  boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_value < 1 or p_value > 99 then
    raise exception 'Value must be between 1 and 99';
  end if;

  if v_user = p_target_id then
    v_eligible := true;
  else
    select
      exists(
        select 1
        from public.team_members tm1
        join public.team_members tm2 on tm1.team_id = tm2.team_id
        join public.teams t          on t.id = tm1.team_id and t.is_active
        where tm1.user_id = v_user
          and tm2.user_id = p_target_id
      )
      or exists(
        select 1 from public.friendships
        where status = 'accepted'
          and ((requester_id = v_user and addressee_id = p_target_id)
            or (requester_id = p_target_id and addressee_id = v_user))
      )
    into v_eligible;
  end if;

  if not v_eligible then
    raise exception 'Only teammates or friends can vote on this player';
  end if;

  insert into public.player_stat_votes(voter_id, target_id, category, value)
  values (v_user, p_target_id, p_category::player_stat_category, p_value)
  on conflict (voter_id, target_id, category)
  do update set
    value      = excluded.value,
    updated_at = now();
end;
$$;


create or replace function public.can_vote_on_player(p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  if v_user = p_target_id then return true; end if;

  return exists(
    select 1
    from public.team_members tm1
    join public.team_members tm2 on tm1.team_id = tm2.team_id
    join public.teams t          on t.id = tm1.team_id and t.is_active
    where tm1.user_id = v_user
      and tm2.user_id = p_target_id
  )
  or exists(
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = v_user and addressee_id = p_target_id)
        or (requester_id = p_target_id and addressee_id = v_user))
  );
end;
$$;
