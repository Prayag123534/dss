create or replace function public.valid_complaint_image_paths(complaint_id uuid, paths text[])
returns boolean
language sql
immutable
strict
as $$
  select cardinality(paths) <= 4
    and coalesce(
      (
        select bool_and(
          attachment.path ~ (
            '^' || complaint_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
          )
        )
        from unnest(paths) as attachment(path)
      ),
      true
    );
$$;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  contact text not null check (char_length(contact) between 3 and 200),
  category text not null check (category in ('Academic', 'Facilities', 'Behavior', 'Administration', 'Other')),
  message text not null check (char_length(message) between 10 and 5000),
  image_paths text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'resolved')),
  created_at timestamptz not null default now(),
  constraint complaints_image_paths_valid check (
    public.valid_complaint_image_paths(id, image_paths)
  )
);

create index if not exists complaints_created_at_idx
  on public.complaints (created_at desc);

alter table public.complaints enable row level security;

revoke all on public.complaints from anon, authenticated;
grant insert (id, name, contact, category, message, image_paths) on public.complaints to anon, authenticated;
grant select, delete on public.complaints to authenticated;
grant update (status) on public.complaints to authenticated;
grant insert, delete on storage.objects to anon, authenticated;
grant select on storage.objects to authenticated;

drop policy if exists "Anyone can submit a complaint" on public.complaints;
create policy "Anyone can submit a complaint"
  on public.complaints
  for insert
  to anon, authenticated
  with check (status = 'new');

drop policy if exists "School admins can view complaints" on public.complaints;
create policy "School admins can view complaints"
  on public.complaints
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.school_admins
      where school_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "School admins can update complaint status" on public.complaints;
create policy "School admins can update complaint status"
  on public.complaints
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.school_admins
      where school_admins.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.school_admins
      where school_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "School admins can delete complaints" on public.complaints;
create policy "School admins can delete complaints"
  on public.complaints
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
  'complaint-images',
  'complaint-images',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can upload complaint images" on storage.objects;
create policy "Public can upload complaint images"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'complaint-images'
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

drop policy if exists "School admins can view complaint images" on storage.objects;
create policy "School admins can view complaint images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'complaint-images'
    and exists (
      select 1
      from public.school_admins
      where school_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Public can remove complaint upload on submission failure" on storage.objects;
create policy "Public can remove complaint upload on submission failure"
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'complaint-images'
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

drop policy if exists "School admins can delete complaint images" on storage.objects;
create policy "School admins can delete complaint images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'complaint-images'
    and exists (
      select 1
      from public.school_admins
      where school_admins.user_id = (select auth.uid())
    )
  );
