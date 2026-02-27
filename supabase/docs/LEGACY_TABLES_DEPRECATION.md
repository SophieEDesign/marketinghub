# Legacy Tables Deprecation Plan

The following tables are deprecated in favor of newer versions with standardized audit fields and schema.

## content_calendar_all

Stub/placeholder table with only `id`, `created_at`, `updated_at`. Reserved for future content calendar unified view or migration. No application usage. See `20250219000000_schema_audit_plan_implementation.sql` for table comment.

## Deprecated Tables (migrate away from)

| Legacy Table | Preferred Table | Notes |
|--------------|-----------------|-------|
| `table_briefings_1766847886126` | `table_briefings_1768073365356` | Newer has `created_by`/`updated_by` FKs |
| `table_campaigns_1766847958019` | `table_campaigns_1768074134170` | Newer has audit fields |
| `table_contacts_1766847128905` | `table_contact_1768073851531` | Newer has audit fields |
| `table_sponsorships_1766847842576` | `table_sponsorships_1768074191424` | Newer has audit fields |
| `table_content_1767726395418` | `table_content_1768242820540` | Newer has audit fields |

## Migration Steps

1. **Audit usage**: Identify all code paths and views referencing legacy tables.
2. **Data migration**: Copy data from legacy to preferred tables; resolve any schema differences.
3. **Update references**: Update `public.tables` metadata, views, and application code to use preferred tables.
4. **Archive**: Rename or drop legacy tables after verification.

## Schema Differences

Legacy tables typically lack:
- `created_by` / `updated_by` (uuid, FK to auth.users)
- Standardized `created_at` / `updated_at` (some use `created` text)

The migration `20250219000000_schema_audit_plan_implementation.sql` adds audit fields to legacy tables where possible. For full alignment, migrate to the preferred tables.
