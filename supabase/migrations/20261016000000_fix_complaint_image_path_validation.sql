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
            '^' || complaint_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'
          )
        )
        from unnest(paths) as attachment(path)
      ),
      true
    );
$$;
