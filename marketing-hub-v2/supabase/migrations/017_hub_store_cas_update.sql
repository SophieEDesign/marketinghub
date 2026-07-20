-- Atomic compare-and-swap for hub_store to prevent lost updates across
-- concurrent serverless writes (e.g. create task + status update racing).

create or replace function public.hub_store_cas_update(
  p_id text,
  p_payload jsonb,
  p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  new_updated_at timestamptz;
begin
  update public.hub_store
  set
    payload = p_payload,
    updated_at = now()
  where id = p_id
    and updated_at = p_expected_updated_at
  returning updated_at into new_updated_at;

  return new_updated_at;
end;
$$;

revoke all on function public.hub_store_cas_update(text, jsonb, timestamptz) from public;
-- Service role bypasses revoke; keep authenticated from calling it directly.
grant execute on function public.hub_store_cas_update(text, jsonb, timestamptz) to service_role;

comment on function public.hub_store_cas_update(text, jsonb, timestamptz) is
  'Update hub_store only when updated_at still matches; returns new updated_at or null on conflict.';
