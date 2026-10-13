drop policy if exists "Public can upload complaint images" on storage.objects;
create policy "Public can upload complaint images"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'complaint-images'
    and name ~* (
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      || '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
      || '\.(jpg|png|webp)$'
    )
  );
