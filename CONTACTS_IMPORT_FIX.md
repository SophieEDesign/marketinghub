# Import Fixes for Contacts and Campaigns Tables

## Contacts Table Issues
The CSV import failed because it tried to import columns that don't exist in the contacts table:
- `first_name` → Should map to `name`
- `events` → Doesn't exist in contacts table
- `content_calendar` → Doesn't exist in contacts table

## Campaigns Table Issues
The CSV import failed because:
- `notes` → Doesn't exist in campaigns table
- Malformed array literal error for multi-select fields

## Current Table Schemas

### Contacts Table
- `name` (required)
- `email`
- `phone`
- `company`
- `notes`
- `created_at`
- `updated_at`

### Campaigns Table
- `name` (required)
- `description`
- `status`
- `colour`
- `start_date`
- `end_date`
- `assignee`
- `created_at`
- `updated_at`

## Solutions

### Option 1: Re-import with Correct Field Mappings (Recommended)

#### For Contacts Table:
1. Go to `/import?table=contacts`
2. Upload your CSV file again
3. In the field mapping step:
   - Map `first_name` CSV column → `name` field
   - Map `email` CSV column → `email` field
   - Map `phone` CSV column → `phone` field
   - Map `company` CSV column → `company` field
   - Map `notes` CSV column → `notes` field
   - Set `events` and `content_calendar` to "IGNORE" (or create new fields if needed)
4. Complete the import

#### For Campaigns Table:
1. Go to `/import?table=campaigns`
2. Upload your CSV file again
3. In the field mapping step:
   - Map all existing fields correctly
   - Set `notes` to "IGNORE" (or create the field if needed)
   - For multi-select fields, ensure values are comma-separated (not array literals)
4. Complete the import

### Option 2: Create Missing Fields (If You Need Them)

#### For Contacts Table:
If you need `events` and `content_calendar` fields:
1. Go to `/tables/contacts/fields`
2. Click "Add Field"
3. Create:
   - Field name: `events` (type: `linked_record` or `multi_select`)
   - Field name: `content_calendar` (type: `linked_record` or `text`)
4. Then re-import your CSV

#### For Campaigns Table:
If you need a `notes` field:
1. Go to `/tables/campaigns/fields`
2. Click "Add Field"
3. Create:
   - Field name: `notes` (type: `long_text`)
4. Then re-import your CSV

### Option 3: Check Current Data
To see if any data was imported:
1. Go to `/tables/contacts`
2. Check if you see any records
3. If empty, you'll see "No records found" message

## Quick Fix: Update CSV Column Names
Before importing, you could rename your CSV columns to match:

### For Contacts:
- `first_name` → `name`
- Remove or rename `events` and `content_calendar` columns

### For Campaigns:
- Remove or rename `notes` column (or create the field first)
- For multi-select fields, ensure values are comma-separated, not array literals

## Verify Import
After re-importing:
1. Check `/tables/contacts` to see your data
2. Verify all expected fields are showing
3. Check the import results page for any remaining errors

