# Block Settings Audit (Marketing Hub / Interface Builder)

Date: 2026-05-28
Scope: `baserow-app` canonical path

## 1) BlockType inventory source of truth

Canonical BlockType: `baserow-app/lib/interface/types.ts`
Registry realization: `baserow-app/lib/interface/registry.ts`
Settings registration: `baserow-app/components/interface/settings/blockSettingsRegistry.tsx`

Note: legacy/incomplete BlockType also exists in `baserow-app/types/database.ts` and can drift from canonical.

## 2) Settings coverage by block families

### Mature data-view blocks (grid/list/calendar/kanban/timeline/gallery)
- Data settings: `GridDataSettings.tsx`
- Appearance: `GridAppearanceSettings.tsx` + `CommonAppearanceSettings.tsx`
- Supports table/view source, fields mapping, filters/sorts/grouping, visibility/display options.

### Marketing custom blocks
- `content_timeline` -> `ContentTimelineDataSettings.tsx`
- `things_to_do` -> `ThingsToDoDataSettings.tsx`
- `upcoming_summary` -> `UpcomingSummaryDataSettings.tsx`
- `internal_resource_hub` -> `InternalResourceHubDataSettings.tsx`
- `social_media_calendar` -> `SocialMediaCalendarDataSettings.tsx`
- `event_calendar` -> `EventCalendarDataSettings.tsx`
- `content_theme` -> `ContentThemeDataSettings.tsx`

All are registered in `blockSettingsRegistry.tsx` and use `CommonAppearanceSettings` for appearance.

## 3) Contract status findings

### What is now in place
- Canonical key usage: `table_id` / `view_id` (no `sourceTableId`/`sourceViewId`)
- Demo key pattern: block-prefixed `*_use_mock`
- Field mapping pattern: `*_field_id` + optional `*_field`
- Runtime hooks consume block config for source resolution and field overrides
- Shared helpers for source + field precedence + demo state:
  - `lib/marketing/block-config-resolver.ts`

### Remaining/known gaps
- `kpi_summary` remains minimal/static vs full generic data-source contract.
- Some blocks have partial rather than full explicit filter/sort/group controls in UI (by design/relevance).
- `list` has legacy `ListDataSettings.tsx` file but registry routes list through `GridDataSettings.tsx`.
- API normalize path can still fallback defaults on invalid payloads (risk for key loss outside panel-controlled flows).

## 4) Persistence/validation flow (where contract can break)

- Edit panel draft + save orchestration: `components/interface/SettingsPanel.tsx`
- API update route: `app/api/pages/[pageId]/blocks/route.ts`
- Validation/normalization: `lib/interface/block-config-types.ts`, `lib/interface/block-validator.ts`

Risk point:
- `normalizeBlockConfig()` can replace invalid config with defaults in server path.

## 5) Enforced rule created

Persistent workspace rule added:
- `.cursor/rules/block-generic-settings-contract.mdc`

It enforces:
- canonical keys
- field precedence (`*_field_id` -> `*_field` -> heuristic)
- baseline settings expectations
- runtime wiring requirement
- no silent demo-as-live fallback

## 6) Quick action recommendations

1. Add CI/test assertion that all canonical BlockTypes have registry + settings + validator coverage.
2. Consider tightening API behavior: reject invalid config instead of default replacement on update route.
3. Keep marketing blocks aligned with same naming/precedence contract as mature data blocks.
