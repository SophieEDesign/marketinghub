# Marketing Hub Workspace Implementation

## Scope implemented

Implemented a marketing-opinionated workspace on top of the existing engine and schema:

- No new tables
- No duplicated data
- No schema changes
- Reused existing interface pages, blocks, and record modal behavior

## Core table posture

### Core (hub-first)
- `Quarterly Themes`
- `Campaigns`
- `Content`

### Supporting/reference
- `Theme – Division Matrix`
- `Sponsorships`
- `Contact`

### Demoted from primary surfaces
- Experimental/noisy interface pages are set to admin-only visibility in curation script.
- `Tasks` and `Events` continue as curated `Content`-based surfaces (no separate schema introduced).

## Data cleanup priorities (applied in surface logic)

Primary dashboard/workspace blocks now default to cleaner datasets by using:

- `is_not_empty` checks on key title/name fields
- date-window filters for upcoming content
- constrained visible fields for cards/lists

This reduces exposure of null-heavy `Content` rows on top-level pages while preserving full record detail in modal views.

## Implemented page hierarchy

1. `Marketing Home` (snapshot)
2. `Theme Workspace` (planning brain)
3. `Campaign Workspace` (execution cluster)
4. `Content Planning` (production surface)

## Mandatory page composition rule implemented

Each curated page is rebuilt with:

- one primary block
- one supporting block
- one compact summary strip (KPI strip)

This is enforced through deterministic block replacement in the apply script.

## Block strategy implemented

### Reconfigured (implemented)
- `GridBlock` with `view_type` (`list`, `gallery`, `calendar`)
- KPI strips for compact summaries
- section headers via HTML blocks
- grouping, filters, row limits, and visible field curation by workspace role

### Styling strategy (deferred to follow-up)
- Existing marketing style context is preserved (`layout_style: marketing_dashboard`)
- Larger visual-system token cleanup can be done as a phase-2 code pass without changing data model

### Rebuild strategy
- No new data engine components introduced
- Optional wrapper components remain a later optimization if repeated page patterns require it

## Safe rollout mechanics

Implemented as repeatable script:

- `baserow-app/scripts/apply-marketing-hub-workspace.cjs`
- package command: `npm run apply:marketing-hub`

Behavior:

- Upserts the 4 curated pages
- Replaces page blocks deterministically
- Applies visibility curation for noisy pages (`is_admin_only = true`)
- Keeps existing schema and linked-model intact

