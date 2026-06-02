# Custom Block Modal Panel Field Audit (2026-06)

## Scope
- Custom-block modal/drawer/panel surfaces in Marketing Hub.
- Standard: shared field components and generic record drawer behavior, plus repo rules for mode propagation and overlay safety.

## Canonical Contracts Applied
- Shared field rendering and behavior: `RecordPanel` -> `RecordEditor` -> `RecordFields` / `FieldEditor`.
- Shared pill/select presentation: `ChoicePill`, shadcn `Select`.
- Mode propagation: pass `interfaceMode` through every custom record-open flow.
- Overlay safety: keep sidebar clickable (`md:left-sidebar`) and keep settings panel layout rules intact.

## Compliance Checklist Used
- Pills/selects use shared components (not bespoke visual systems).
- Select option editing/addition remains in shared field controls (`FieldEditor` / `InlineFieldEditor`) once record drawer opens.
- Linked-record, date, media, validation, permissions, save, dirty-state, draft restore remain handled by shared record editor core.
- Custom panels may change section grouping/order/preview only, not field interaction mechanics.

## Surfaces Audited
- `baserow-app/components/interface/blocks/ContentTimelineBlock.tsx`
- `baserow-app/components/interface/blocks/ThingsToDoBlock.tsx`
- `baserow-app/components/interface/blocks/CampaignsOverviewBlock.tsx`
- `baserow-app/components/interface/SocialMediaCalendarCore.tsx`
- `baserow-app/components/interface/EventCalendarCore.tsx`
- `baserow-app/components/interface/content-timeline/ContentTimelineDetailPanel.tsx`
- `baserow-app/components/interface/things-to-do/ThingsToDoDetailPanel.tsx`
- `baserow-app/components/interface/things-to-do/ThingsToDoRecordSidePanel.tsx`
- `baserow-app/components/interface/EventDetailPanel.tsx`
- `baserow-app/components/interface/EventDetailDrawer.tsx`

## Changes Implemented
- Standardized campaign filter controls from native `<select>` to shared `Select` components:
  - `baserow-app/components/interface/blocks/CampaignsOverviewBlock.tsx`
- Standardized campaign/status/type/priority pill rendering to shared `ChoicePill` style:
  - `baserow-app/components/interface/blocks/CampaignsOverviewBlock.tsx`
  - `baserow-app/components/interface/content-timeline/ContentTimelineStatusBadge.tsx`
  - `baserow-app/components/interface/things-to-do/ThingsToDoBadges.tsx`
- Added `interfaceMode` propagation in custom side panel open/edit path:
  - `baserow-app/components/interface/things-to-do/ThingsToDoRecordSidePanel.tsx`

## Intentional Exceptions
- `ContentTimelineDetailPanel`, `ThingsToDoDetailPanel`, and `EventDetailPanel` remain custom summary layouts (grouping/tabs/preview/actions).
- These panels defer actual field editing semantics to shared record drawer/editor when opening records.
- This preserves bespoke layout while preventing a forked field interaction system.

## Regression Safety Notes
- Sidebar-clickable overlay rule remains satisfied by existing `md:left-sidebar` overlays in record/event shells.
- Edit/view mode behavior continues to flow through `interfaceMode` in custom record-open paths.
- No new bespoke field controls were introduced.
