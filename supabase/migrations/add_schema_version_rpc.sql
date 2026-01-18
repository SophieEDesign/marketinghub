create or replace function public.get_schema_version()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  has_table boolean;
  latest text;
begin
  select to_regclass('supabase_migrations.schema_migrations') is not null into has_table;
  if not has_table then
    return null;
  end if;

  select version::text
    into latest
    from supabase_migrations.schema_migrations
    order by version desc
    limit 1;

  return latest;
end;
$$;

grant execute on function public.get_schema_version() to anon, authenticated;
