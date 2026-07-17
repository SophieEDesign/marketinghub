# RLS Inventory & Risk Summary (Phase 1)

This inventory is focused on authorization/RLS hardening only.

## High-Sensitivity Tables (Hardened in this phase)

| table | broad/permissive policy found | risk | intended actor | intended read scope | intended write scope | workspace scoping exists yet |
|---|---|---|---|---|---|---|
| `interface_pages` | yes (`USING (true)` / broad authenticated write) | high | authenticated users + admins | authenticated users read non-archived pages; admin-only pages visible to admin only | admin-only create/update/delete | partial (`group_id` exists; no strict workspace FK model) |
| `interface_groups` | yes (authenticated manage all) | high | authenticated users + admins | authenticated users read | admin-only create/update/delete | partial (`workspace_id` exists but legacy nulls/optional usage) |
| `workspaces` | yes (authenticated update/insert) | high | authenticated users + admins | authenticated users read workspace identity | admin-only create/update/delete | single-workspace model currently dominant |
| `workspace_settings` | yes (`USING (true)` read plus broad historical writes) | high | authenticated users + admins | authenticated users read branding/default settings | admin-only create/update/delete | yes (`workspace_id`, type normalized to `text`) |
| `user_roles` (legacy) | yes (`USING (true)` read-all) | high | users + admins | user reads own rows, admin reads all | admin-only create/update/delete | no explicit workspace scope on table |

## Medium/High Risk Tables Not Hardened Yet (Ambiguous model; not guessed)

For each table below, hardening is deferred until access model is explicitly confirmed.

### `tables`
- intended actor: **ambiguous**
- intended read scope: **ambiguous**
- intended write scope: **ambiguous**
- workspace scoping exists yet: **unclear/partial**

### `views`
- intended actor: **ambiguous**
- intended read scope: **ambiguous**
- intended write scope: **ambiguous**
- workspace scoping exists yet: **unclear/partial**

### `view_blocks`
- intended actor: **ambiguous**
- intended read scope: **ambiguous**
- intended write scope: **ambiguous**
- workspace scoping exists yet: **unclear/partial**

### `table_fields`
- intended actor: **ambiguous**
- intended read scope: **ambiguous**
- intended write scope: **ambiguous**
- workspace scoping exists yet: **unclear/partial**

### Dynamic data tables (`pm_*` and similar generated tables)
- intended actor: **ambiguous**
- intended read scope: **ambiguous**
- intended write scope: **ambiguous**
- workspace scoping exists yet: **not consistently represented**

## Policy Intent Applied in Phase 1

- replace `USING (true)`/`WITH CHECK (true)` with explicit role checks
- preserve read access where required for normal app navigation
- restrict all write paths on high-sensitivity config/auth tables to admins only
- avoid changes on ambiguous tables to prevent accidental lockouts

## Rollout Notes

- This phase may block non-admin edits in flows that previously depended on permissive RLS.
- Any API or client code that performed direct writes to hardened tables as non-admin now needs explicit admin authorization flow.
