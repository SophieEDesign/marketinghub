# Marketing Hub Staging QA — June 2026

Run on **staging/preview** after deploy. Mark each item Pass / Fail / N/A and note build URL + date.

Reference: [MARKETING_HUB_FULL_CHECKPOINT_2026-06.md](./MARKETING_HUB_FULL_CHECKPOINT_2026-06.md) §15, REG-005 in [REGRESSION_RISK_AUDIT_2026-05.md](./REGRESSION_RISK_AUDIT_2026-05.md).

## Environment

| Field | Value |
|-------|--------|
| URL | |
| Date | |
| Tester | |
| Role tested | admin / editor / member preview |

## Layout & edit mode

- [ ] Enter page edit mode → `RightSettingsPanel` 360px; canvas flex-1
- [ ] Select block → settings reflect selection; no layout width tied to selection alone
- [ ] **REG-005:** Edit block layout (move/resize) → save → trigger realtime/blocks reload → unsaved layout **not** overwritten
- [ ] Content Timeline: item click in edit mode selects block only (no drawer)
- [ ] Resource Hub: list/gallery/manage guarded in edit mode

## Navigation & overlays

- [ ] Marketing Home → Campaigns → back: no blank flash; blocks appear
- [ ] With record drawer open: sidebar page links still clickable (`md:left-sidebar` overlay)
- [ ] Sidebar hover prefetch: second visit to same page feels faster (optional subjective)

## Record drawers

- [ ] Social post → `social_post` layout; save/discard works
- [ ] Event → contextual event view + attendance
- [ ] Task / Campaign / Content / Asset layouts open from respective blocks
- [ ] Linked record from drawer preserves contextual layout (campaign/event/content/task where table name matches)
- [ ] Content Theme: Add theme / Add idea / open theme title (live data only)

## Marketing blocks

- [ ] Upcoming Summary “View all” navigates to workspace pages
- [ ] Content Timeline footer navigates to Content Planning / Social Calendar
- [ ] Filter/search changes announce result counts (screen reader spot-check)
- [ ] Members Welcome: view-all links inactive in edit mode

## Members & mobile

- [ ] Member preview cannot access admin-only pages
- [ ] Members Welcome hides internal-only events/resources where configured
- [ ] Mobile: Marketing Home + one full-page calendar; filters scroll acceptably

## Sign-off

| Result | Notes |
|--------|--------|
| Pass / Fail | |
