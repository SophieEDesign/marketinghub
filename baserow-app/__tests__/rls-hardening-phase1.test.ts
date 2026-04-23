import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readMigration() {
  const migrationPath = join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260421000003_rls_hardening_sweep_phase1.sql"
  )
  return readFileSync(migrationPath, "utf8")
}

describe("RLS Hardening Phase 1 migration", () => {
  it("adds admin-gated write policies for hardened tables", () => {
    const sql = readMigration()

    const requiredChecks = [
      'CREATE POLICY "rls_interface_pages_insert_admin"',
      'CREATE POLICY "rls_interface_pages_update_admin"',
      'CREATE POLICY "rls_interface_pages_delete_admin"',
      'CREATE POLICY "rls_interface_groups_insert_admin"',
      'CREATE POLICY "rls_interface_groups_update_admin"',
      'CREATE POLICY "rls_interface_groups_delete_admin"',
      'CREATE POLICY "rls_workspaces_update_admin"',
      'CREATE POLICY "rls_workspace_settings_update_admin"',
      'CREATE POLICY "rls_user_roles_update_admin"',
      "public.is_admin(auth.uid())",
    ]

    for (const marker of requiredChecks) {
      expect(sql).toContain(marker)
    }
  })

  it("removes permissive true-based policies on target tables", () => {
    const sql = readMigration()

    expect(sql).toContain("Drop broad permissive policies")
    expect(sql).toContain("COALESCE(TRIM(qual), '') IN ('true', '(true)')")
    expect(sql).toContain("COALESCE(TRIM(with_check), '') IN ('true', '(true)')")
  })

  it("keeps explicit scoped read paths for authenticated users", () => {
    const sql = readMigration()

    expect(sql).toContain('CREATE POLICY "rls_interface_pages_select_scoped"')
    expect(sql).toContain("COALESCE(is_admin_only, false) = false OR public.is_admin(auth.uid())")
    expect(sql).toContain('CREATE POLICY "rls_workspace_settings_select_authenticated"')
    expect(sql).toContain('CREATE POLICY "rls_user_roles_select_own"')
    expect(sql).toContain('CREATE POLICY "rls_user_roles_select_admin_all"')
  })
})
