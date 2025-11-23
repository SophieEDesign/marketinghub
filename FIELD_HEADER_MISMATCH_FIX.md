# Field Header Mismatch Fix

## Issue
Column headers in GridView don't match the data below them.

## Root Cause
The GridView uses:
- `field.label` for column headers
- `row[field.field_key]` for cell data

If `field.field_key` doesn't match the actual database column name, the data won't display correctly.

## Solution
1. Ensure `field_key` in `table_fields` matches actual database column names
2. Verify field labels are correct
3. Check field order matches display order

## Debugging Steps
1. Check what fields are loaded: `console.log(fields)` in GridView
2. Check what data is loaded: `console.log(rows[0])` to see actual column names
3. Compare `field.field_key` with actual database column names
4. Ensure `table_fields` records have correct `field_key` values

## Quick Fix
If field_keys are wrong in database, update them:
```sql
UPDATE table_fields 
SET field_key = 'title' 
WHERE table_id = 'content' AND label = 'Title';
```

Or regenerate fields from schema.

