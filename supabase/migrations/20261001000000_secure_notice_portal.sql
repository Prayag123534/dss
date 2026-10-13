create table if not exists public.school_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.school_admins enable row level security;

revoke all on public.school_admins from anon, authenticated;
grant select on public.school_admins to authenticated;

drop policy if exists "Admins can read their own allowlist entry" on public.school_admins;
create policy "Admins can read their own allowlist entry"
  on public.school_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  notice_date date not null,
  summary text not null,
  image_url text,
  image_path text,
  created_at timestamptz not null default now()
);

alter table public.notices enable row level security;

revoke all on public.notices from anon, authenticated;
grant select on public.notices to anon, authenticated;
grant insert, delete on public.notices to authenticated;

drop policy if exists "Notices are public to read" on public.notices;
create policy "Notices are public to read"
  on public.notices
  for select
  to anon, authenticated
  using (true);

drop policy if exists "School admins can publish notices" on public.notices;
create policy "School admins can publish notices"
  on public.notices
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.school_admins
      where school_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "School admins can delete notices" on public.notices;
create policy "School admins can delete notices"
  on public.notices
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.school_admins
      where school_admins.user_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notice-images',
  'notice-images',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Notice images are public to read" on storage.objects;
create policy "Notice images are public to read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'notice-images');

drop policy if exists "School admins can upload notice images" on storage.objects;
create policy "School admins can upload notice images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'notice-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.school_admins
      where school_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "School admins can delete notice images" on storage.objects;
create policy "School admins can delete notice images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'notice-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.school_admins
      where school_admins.user_id = (select auth.uid())
    )
  );