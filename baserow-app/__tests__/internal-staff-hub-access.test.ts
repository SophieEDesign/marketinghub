import { describe, expect, it } from "vitest"
import { isInternalStaffHubPage } from "@/lib/marketing/internal-staff-hub"

function memberCanSeePage(userIsAdmin: boolean, page: { is_admin_only?: boolean | null }) {
  if (userIsAdmin) return true
  return page.is_admin_only !== true
}

function internalStaffHubCanEdit(isAdmin: boolean, isViewer: boolean) {
  return isAdmin && !isViewer
}

describe("Internal Staff Hub member access", () => {
  it("detects hub by layout_style", () => {
    expect(
      isInternalStaffHubPage({
        name: "Resources",
        config: { layout_style: "internal_staff_hub" },
      })
    ).toBe(true)
  })

  it("detects hub by page name", () => {
    expect(isInternalStaffHubPage({ name: "Internal Staff Hub", config: {} })).toBe(true)
  })

  it("allows members when is_admin_only is false", () => {
    expect(memberCanSeePage(false, { is_admin_only: false })).toBe(true)
  })

  it("blocks members when is_admin_only is true", () => {
    expect(memberCanSeePage(false, { is_admin_only: true })).toBe(false)
  })

  it("allows admins regardless of is_admin_only", () => {
    expect(memberCanSeePage(true, { is_admin_only: true })).toBe(true)
  })

  it("gates Upload to admins outside view preview", () => {
    expect(internalStaffHubCanEdit(true, false)).toBe(true)
    expect(internalStaffHubCanEdit(false, false)).toBe(false)
    expect(internalStaffHubCanEdit(true, true)).toBe(false)
    expect(internalStaffHubCanEdit(false, true)).toBe(false)
  })
})
