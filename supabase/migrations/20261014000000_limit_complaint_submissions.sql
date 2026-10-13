create index if not exists complaints_contact_created_at_idx
  on public.complaints (lower(btrim(contact)), created_at desc);

create or replace function public.enforce_complaint_submission_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(lower(btrim(new.contact)), 0)
  );

  if (
    select count(*)
    from public.complaints
    where lower(btrim(contact)) = lower(btrim(new.contact))
      and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'Complaint submission limit reached. Please try again later.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_complaint_submission_rate_limit() from public, anon, authenticated;

drop trigger if exists complaints_submission_rate_limit on public.complaints;
create trigger complaints_submission_rate_limit
  before insert on public.complaints
  for each row
  execute function public.enforce_complaint_submission_rate_limit();
