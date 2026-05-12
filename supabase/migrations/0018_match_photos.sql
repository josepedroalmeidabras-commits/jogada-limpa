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
