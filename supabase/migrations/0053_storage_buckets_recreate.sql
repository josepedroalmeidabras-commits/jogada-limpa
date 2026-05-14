-- =============================================================================
-- STORAGE BUCKETS: ensure all 3 buckets + RLS policies exist
-- =============================================================================
-- 0007 criou-os mas algo correu mal — a API REST devolve [] para a lista de
-- buckets. Recriamos idempotentemente.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('match-photos', 'match-photos', true)
on conflict (id) do nothing;


-- ----------------------------- AVATARS -----------------------------
drop policy if exists "avatar_insert_own" on storage.objects;
drop policy if exists "avatar_update_own" on storage.objects;
drop policy if exists "avatar_delete_own" on storage.objects;
drop policy if exists "avatar_read_all"   on storage.objects;

create policy "avatar_read_all"
  on storage.objects for select to authenticated, anon
  using (bucket_id = 'avatars');

create policy "avatar_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatar_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatar_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ----------------------------- TEAM LOGOS -----------------------------
drop policy if exists "team_logo_insert_captain" on storage.objects;
drop policy if exists "team_logo_update_captain" on storage.objects;
drop policy if exists "team_logo_delete_captain" on storage.objects;
drop policy if exists "team_logo_read_all"       on storage.objects;

create policy "team_logo_read_all"
  on storage.objects for select to authenticated, anon
  using (bucket_id = 'team-logos');

create policy "team_logo_insert_captain"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'team-logos'
    and exists (
      select 1 from public.teams t
      where t.id::text = (storage.foldername(name))[1]
        and t.captain_id = auth.uid()
    )
  );

create policy "team_logo_update_captain"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'team-logos'
    and exists (
      select 1 from public.teams t
      where t.id::text = (storage.foldername(name))[1]
        and t.captain_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'team-logos'
    and exists (
      select 1 from public.teams t
      where t.id::text = (storage.foldername(name))[1]
        and t.captain_id = auth.uid()
    )
  );

create policy "team_logo_delete_captain"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'team-logos'
    and exists (
      select 1 from public.teams t
      where t.id::text = (storage.foldername(name))[1]
        and t.captain_id = auth.uid()
    )
  );


-- ----------------------------- MATCH PHOTOS -----------------------------
drop policy if exists "match_photo_insert_participant" on storage.objects;
drop policy if exists "match_photo_read_all"           on storage.objects;
drop policy if exists "match_photo_delete_uploader"    on storage.objects;

create policy "match_photo_read_all"
  on storage.objects for select to authenticated, anon
  using (bucket_id = 'match-photos');

create policy "match_photo_insert_participant"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'match-photos'
    and exists (
      select 1 from public.match_participants mp
      where mp.match_id::text = (storage.foldername(name))[1]
        and mp.user_id = auth.uid()
    )
  );

create policy "match_photo_delete_uploader"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'match-photos'
    and owner = auth.uid()
  );
