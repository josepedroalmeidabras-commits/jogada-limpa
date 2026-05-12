-- =============================================================================
-- Storage buckets: avatars (users) + team-logos (teams)
-- =============================================================================
-- Path convention: <id>/<filename>, where <id> is the user id or team id.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

-- ------------- avatars: each user manages files under their own uid -----------
drop policy if exists "avatar_insert_own"  on storage.objects;
drop policy if exists "avatar_update_own"  on storage.objects;
drop policy if exists "avatar_delete_own"  on storage.objects;

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
  );

create policy "avatar_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ------------- team-logos: only the captain of the team can write -------------
drop policy if exists "team_logo_insert_captain" on storage.objects;
drop policy if exists "team_logo_update_captain" on storage.objects;
drop policy if exists "team_logo_delete_captain" on storage.objects;

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
