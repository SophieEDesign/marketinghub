# API routes — pages vs interface-pages

## Prefer `interface-pages` (canonical)

- Table: `interface_pages`
- Routes: `/api/interface-pages/*`
- Auth: `requireAdmin` for mutations; use `lib/api/error-handling.ts`
- Dynamic params: `params: Promise<{ pageId: string }>`

## Legacy `pages` (compatibility)

- Routes: `/api/pages/*` — blocks layout, older page CRUD
- Still used by **InterfacePageClient** `loadBlocks` → `GET /api/pages/[pageId]/blocks`
- Do not add new features here; add deprecation comment when touching handlers

## Search

- `/api/search` — extend to include `interface_pages` when adding global search features
