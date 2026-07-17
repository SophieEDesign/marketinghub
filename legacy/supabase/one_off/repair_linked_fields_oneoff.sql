-- Repair (historic) `link_to_table` fields to be bidirectional (Node-free).
--
-- Use this when historic linked fields may have:
-- - no reciprocal field in the other table
-- - a reciprocal field that exists but isn’t connected via options.linked_field_id
-- - a reciprocal field/column that exists but has no data (so it looks unlinked)
--
-- How to run (recommended):
-- 1) In Supabase Dashboard → SQL editor, paste this whole file and run it.
-- 2) Dry run first:
--    select * from public.repair_linked_fields_oneoff(dry_run => true);
-- 3) Apply changes:
--    select * from public.repair_linked_fields_oneoff(dry_run => false);
--
-- Optional parameters:
-- - no_backfill: set true to skip copying values into the reciprocal columns.
-- - limit_count: set to an integer to only process the first N link fields.
--
-- Notes:
-- - This is a one-off schema+data repair. It does NOT keep links in sync going forward.
-- - For dry runs, this function returns accurate counts for schema/options/view visibility actions,
--   but does NOT attempt to estimate backfill row updates.
--
-- Cleanup (optional, after you’re done):
--   drop function if exists public.repair_linked_fields_oneoff(boolean, boolean, integer);
--
create or replace function public.repair_linked_fields_oneoff(
  dry_run boolean default true,
  no_backfill boolean default false,
  limit_count integer default null
)
returns table (
  processed integer,
  created_reciprocals integer,
  repaired_pairs integer,
  view_fields_inserted integer,
  backfill_row_updates bigint
)
language plpgsql
as $$
declare
  f record;

  source_tbl public.tables%rowtype;
  target_tbl public.tables%rowtype;
  reciprocal public.table_fields%rowtype;

  target_table_id uuid;
  linked_field_id uuid;

  source_table_sql text;
  target_table_sql text;

  reciprocal_label text;
  base_name text;
  candidate_name text;
  suffix int;
  name_exists boolean;

  next_position int;
  next_order_index int;

  source_options jsonb;
  reciprocal_options jsonb;

  source_needs_update boolean;
  reciprocal_needs_update boolean;

  target_is_multi boolean;
  backfill_sql text;
  updated_rows bigint;
  inserted_rows int;

  has_target_table boolean;
begin
  processed := 0;
  created_reciprocals := 0;
  repaired_pairs := 0;
  view_fields_inserted := 0;
  backfill_row_updates := 0;

  raise notice 'Repair linked fields (dry_run=%, backfill=%)', dry_run, (not no_backfill);

  for f in
    select id, table_id, name, label, type, position, order_index, options, created_at
    from public.table_fields
    where type = 'link_to_table'
    order by created_at asc
  loop
    processed := processed + 1;
    if limit_count is not null and processed > limit_count then
      exit;
    end if;

    source_options := coalesce(f.options, '{}'::jsonb);
    if (source_options ->> 'linked_table_id') is null then
      continue;
    end if;

    begin
      target_table_id := (source_options ->> 'linked_table_id')::uuid;
    exception when others then
      continue;
    end;

    if target_table_id = f.table_id then
      continue;
    end if;

    select *
      into source_tbl
      from public.tables
     where id = f.table_id
     limit 1;

    if source_tbl.id is null then
      continue;
    end if;

    select *
      into target_tbl
      from public.tables
     where id = target_table_id
     limit 1;

    if target_tbl.id is null then
      continue;
    end if;

    -- Build quoted table names (handles "public.foo" or "foo")
    if position('.' in source_tbl.supabase_table) > 0 then
      source_table_sql := quote_ident(split_part(source_tbl.supabase_table, '.', 1)) || '.' || quote_ident(split_part(source_tbl.supabase_table, '.', 2));
    else
      source_table_sql := quote_ident(source_tbl.supabase_table);
    end if;

    if position('.' in target_tbl.supabase_table) > 0 then
      target_table_sql := quote_ident(split_part(target_tbl.supabase_table, '.', 1)) || '.' || quote_ident(split_part(target_tbl.supabase_table, '.', 2));
    else
      target_table_sql := quote_ident(target_tbl.supabase_table);
    end if;

    -- Try reciprocal via options.linked_field_id
    reciprocal := null;
    linked_field_id := null;
    if source_options ? 'linked_field_id' then
      begin
        linked_field_id := (source_options ->> 'linked_field_id')::uuid;
      exception when others then
        linked_field_id := null;
      end;

      if linked_field_id is not null then
        select *
          into reciprocal
          from public.table_fields
         where id = linked_field_id
         limit 1;

        if reciprocal.id is not null and reciprocal.type is distinct from 'link_to_table' then
          reciprocal := null;
        end if;
      end if;
    end if;

    -- Otherwise find an existing reciprocal in target table that points back.
    if reciprocal.id is null then
      select *
        into reciprocal
        from public.table_fields
       where table_id = target_tbl.id
         and type = 'link_to_table'
         and coalesce(options, '{}'::jsonb) @> jsonb_build_object('linked_table_id', source_tbl.id::text)
       order by created_at asc
       limit 1;
    end if;

    -- If still missing, create reciprocal metadata + physical column.
    if reciprocal.id is null then
      reciprocal_label := coalesce(nullif(btrim(source_tbl.name), ''), nullif(btrim(f.label), ''), 'Linked records');

      base_name := regexp_replace(lower(btrim(reciprocal_label)), '[^a-z0-9_]+', '_', 'g');
      base_name := regexp_replace(base_name, '_+', '_', 'g');
      base_name := regexp_replace(base_name, '^_+|_+$', '', 'g');
      base_name := left(base_name, 63);
      if base_name is null or base_name = '' then
        base_name := 'linked_records';
      end if;

      candidate_name := base_name;
      suffix := 0;
      loop
        select exists(
          select 1
            from public.table_fields
           where table_id = target_tbl.id
             and lower(name) = lower(candidate_name)
        ) into name_exists;
        exit when not name_exists;

        suffix := suffix + 1;
        if suffix > 50 then
          raise exception 'Failed to find unique reciprocal field name (base=%)', base_name;
        end if;
        candidate_name := left(base_name || '_' || suffix::text, 63);
      end loop;

      select count(*)::int
        into next_position
        from public.table_fields
       where table_id = target_tbl.id;

      select (coalesce(max(coalesce(order_index, position)), -1) + 1)::int
        into next_order_index
        from public.table_fields
       where table_id = target_tbl.id;

      reciprocal_options :=
        coalesce(source_options, '{}'::jsonb)
        || jsonb_build_object('linked_table_id', source_tbl.id::text, 'linked_field_id', f.id::text);

      target_is_multi :=
        (reciprocal_options ->> 'relationship_type') in ('one-to-many', 'many-to-many')
        or (
          case
            when (reciprocal_options ? 'max_selections')
              and (reciprocal_options ->> 'max_selections') ~ '^[0-9]+$'
            then (reciprocal_options ->> 'max_selections')::int
            else null
          end
        ) > 1;

      if dry_run then
        created_reciprocals := created_reciprocals + 1;
        raise notice 'Would create reciprocal field: table=% col=% label=%', target_tbl.supabase_table, candidate_name, reciprocal_label;
        -- Keep reciprocal.id null in dry-run; we still count repairs/view visibility actions.
      else
        insert into public.table_fields (table_id, name, label, type, position, order_index, required, default_value, options)
        values (target_tbl.id, candidate_name, reciprocal_label, 'link_to_table', next_position, next_order_index, false, null, reciprocal_options)
        returning *
        into reciprocal;

        created_reciprocals := created_reciprocals + 1;

        execute format(
          'alter table %s add column if not exists %I %s;',
          target_table_sql,
          candidate_name,
          case when target_is_multi then 'uuid[]' else 'uuid' end
        );
      end if;
    end if;

    -- Determine desired options pointers.
    source_needs_update := false;
    reciprocal_needs_update := false;

    if reciprocal.id is not null then
      source_needs_update := (source_options ->> 'linked_field_id') is distinct from reciprocal.id::text;
      reciprocal_options :=
        coalesce(reciprocal.options, '{}'::jsonb)
        || jsonb_build_object('linked_table_id', source_tbl.id::text, 'linked_field_id', f.id::text);
      reciprocal_needs_update :=
        (coalesce(reciprocal.options, '{}'::jsonb) ->> 'linked_field_id') is distinct from f.id::text
        or (coalesce(reciprocal.options, '{}'::jsonb) ->> 'linked_table_id') is distinct from source_tbl.id::text;
    else
      -- Dry-run created reciprocal has no id, but we can still count the pair as needing repair.
      source_needs_update := true;
      reciprocal_needs_update := true;
    end if;

    if source_needs_update or reciprocal_needs_update then
      repaired_pairs := repaired_pairs + 1;
    end if;

    if not dry_run then
      if source_needs_update and reciprocal.id is not null then
        update public.table_fields
           set options = (coalesce(source_options, '{}'::jsonb) || jsonb_build_object('linked_field_id', reciprocal.id::text)),
               updated_at = now()
         where id = f.id;
      end if;

      if reciprocal_needs_update and reciprocal.id is not null then
        update public.table_fields
           set options = reciprocal_options,
               updated_at = now()
         where id = reciprocal.id;
      end if;
    end if;

    -- Ensure reciprocal physical column exists even if metadata existed (schema repair).
    if not dry_run and reciprocal.id is not null then
      target_is_multi :=
        (coalesce(reciprocal.options, '{}'::jsonb) ->> 'relationship_type') in ('one-to-many', 'many-to-many')
        or (
          case
            when (coalesce(reciprocal.options, '{}'::jsonb) ? 'max_selections')
              and (coalesce(reciprocal.options, '{}'::jsonb) ->> 'max_selections') ~ '^[0-9]+$'
            then (coalesce(reciprocal.options, '{}'::jsonb) ->> 'max_selections')::int
            else null
          end
        ) > 1;

      execute format(
        'alter table %s add column if not exists %I %s;',
        target_table_sql,
        reciprocal.name,
        case when target_is_multi then 'uuid[]' else 'uuid' end
      );
    end if;

    -- Ensure view_fields rows exist (for source field)
    select count(*)::int
      into inserted_rows
      from public.views v
     where v.table_id = f.table_id
       and not exists (
         select 1
           from public.view_fields vf
          where vf.view_id = v.id
            and vf.field_name = f.name
       );

    if inserted_rows > 0 then
      if not dry_run then
        insert into public.view_fields (view_id, field_name, visible, position)
        select v.id, f.name, true, coalesce(f.position, 0)
          from public.views v
         where v.table_id = f.table_id
           and not exists (
             select 1
               from public.view_fields vf
              where vf.view_id = v.id
                and vf.field_name = f.name
           );
      end if;
      view_fields_inserted := view_fields_inserted + inserted_rows;
    end if;

    -- Ensure view_fields rows exist (for reciprocal field)
    if reciprocal.id is not null then
      select count(*)::int
        into inserted_rows
        from public.views v
       where v.table_id = reciprocal.table_id
         and not exists (
           select 1
             from public.view_fields vf
            where vf.view_id = v.id
              and vf.field_name = reciprocal.name
         );

      if inserted_rows > 0 then
        if not dry_run then
          insert into public.view_fields (view_id, field_name, visible, position)
          select v.id, reciprocal.name, true, coalesce(reciprocal.position, 0)
            from public.views v
           where v.table_id = reciprocal.table_id
             and not exists (
               select 1
                 from public.view_fields vf
                where vf.view_id = v.id
                  and vf.field_name = reciprocal.name
             );
        end if;
        view_fields_inserted := view_fields_inserted + inserted_rows;
      end if;
    end if;

    -- Backfill reciprocal values based on existing source data.
    if dry_run then
      -- Not estimating backfill counts in dry-run.
      continue;
    end if;

    if no_backfill then
      continue;
    end if;

    if reciprocal.id is null then
      continue;
    end if;

    -- Confirm the target table exists before attempting dynamic updates (helps avoid confusing errors).
    select exists(
      select 1
        from information_schema.tables t
       where t.table_schema = case
         when position('.' in target_tbl.supabase_table) > 0 then split_part(target_tbl.supabase_table, '.', 1)
         else 'public'
       end
         and t.table_name = case
           when position('.' in target_tbl.supabase_table) > 0 then split_part(target_tbl.supabase_table, '.', 2)
           else target_tbl.supabase_table
         end
    ) into has_target_table;

    if not has_target_table then
      raise notice 'Skipping backfill: target table % does not exist', target_tbl.supabase_table;
      continue;
    end if;

    target_is_multi :=
      (coalesce(reciprocal.options, '{}'::jsonb) ->> 'relationship_type') in ('one-to-many', 'many-to-many')
      or (
        case
          when (coalesce(reciprocal.options, '{}'::jsonb) ? 'max_selections')
            and (coalesce(reciprocal.options, '{}'::jsonb) ->> 'max_selections') ~ '^[0-9]+$'
          then (coalesce(reciprocal.options, '{}'::jsonb) ->> 'max_selections')::int
          else null
        end
      ) > 1;

    begin
      if target_is_multi then
        backfill_sql := format($q$
with links as (
  select
    s.id as source_id,
    unnest(
      case
        when pg_typeof(s.%1$I)::text = 'uuid[]' then coalesce(s.%1$I, array[]::uuid[])
        when pg_typeof(s.%1$I)::text = 'uuid' then case when s.%1$I is null then array[]::uuid[] else array[s.%1$I] end
        else array[]::uuid[]
      end
    ) as target_id
  from %2$s s
),
agg as (
  select target_id, array_agg(distinct source_id) as add_ids
  from links
  where target_id is not null
  group by target_id
),
upd as (
  update %3$s t
     set %4$I = next_arr
    from agg
    cross join lateral (
      select array_agg(distinct x) as next_arr
      from unnest(coalesce(t.%4$I, array[]::uuid[]) || agg.add_ids) x
    ) u
   where t.id = agg.target_id
     and u.next_arr is distinct from t.%4$I
  returning 1
)
select count(*)::bigint from upd;
$q$,
          f.name,
          source_table_sql,
          target_table_sql,
          reciprocal.name
        );

        execute backfill_sql into updated_rows;
      else
        backfill_sql := format($q$
with links as (
  select
    s.id as source_id,
    unnest(
      case
        when pg_typeof(s.%1$I)::text = 'uuid[]' then coalesce(s.%1$I, array[]::uuid[])
        when pg_typeof(s.%1$I)::text = 'uuid' then case when s.%1$I is null then array[]::uuid[] else array[s.%1$I] end
        else array[]::uuid[]
      end
    ) as target_id
  from %2$s s
),
pick as (
  select target_id, min(source_id) as source_id
  from links
  where target_id is not null
  group by target_id
),
upd as (
  update %3$s t
     set %4$I = pick.source_id
    from pick
   where t.id = pick.target_id
     and t.%4$I is null
  returning 1
)
select count(*)::bigint from upd;
$q$,
          f.name,
          source_table_sql,
          target_table_sql,
          reciprocal.name
        );

        execute backfill_sql into updated_rows;
      end if;

      backfill_row_updates := backfill_row_updates + coalesce(updated_rows, 0);
    exception when others then
      raise notice 'Backfill skipped for %.% → %.% (%): %',
        source_tbl.supabase_table, f.name, target_tbl.supabase_table, reciprocal.name, case when target_is_multi then 'uuid[]' else 'uuid' end, sqlerrm;
      continue;
    end;
  end loop;

  return query
  select processed, created_reciprocals, repaired_pairs, view_fields_inserted, backfill_row_updates;
end;
$$;

