import { describe, it, expect } from "vitest"
import {
  isMemberPreviewSearch,
  withMemberPreviewHref,
  filterInterfacePagesForNav,
  isPageEditableForUser,
} from "@/lib/navigation/member-preview"

describe("member preview navigation helpers", () => {
  it("detects preview=member and legacy view=true", () => {
    expect(isMemberPreviewSearch("?preview=member")).toBe(true)
    expect(isMemberPreviewSearch("?view=true")).toBe(true)
    expect(isMemberPreviewSearch("?preview=member&foo=1")).toBe(true)
    expect(isMemberPreviewSearch("")).toBe(false)
    expect(isMemberPreviewSearch("?preview=admin")).toBe(false)
  })

  it("withMemberPreviewHref adds or removes preview query", () => {
    expect(withMemberPreviewHref("/pages/abc", true)).toBe("/pages/abc?preview=member")
    expect(withMemberPreviewHref("/pages/abc?view=true", true)).toBe(
      "/pages/abc?preview=member"
    )
    expect(withMemberPreviewHref("/pages/abc?preview=member", false)).toBe("/pages/abc")
    expect(withMemberPreviewHref("/pages/abc?foo=1&preview=member", false)).toBe(
      "/pages/abc?foo=1"
    )
  })

  it("filterInterfacePagesForNav hides admin-only and hidden when previewing", () => {
    const pages = [
      { id: "1", name: "Home", is_admin_only: false, is_hidden: false },
      { id: "2", name: "Secret", is_admin_only: true, is_hidden: false },
      { id: "3", name: "Hidden", is_admin_only: false, is_hidden: true },
    ]
    expect(filterInterfacePagesForNav(pages, false).map((p) => p.id)).toEqual(["1", "2"])
    expect(filterInterfacePagesForNav(pages, true).map((p) => p.id)).toEqual(["1"])
  })

  it("isPageEditableForUser is false for admin in member preview", () => {
    expect(isPageEditableForUser(true, false)).toBe(true)
    expect(isPageEditableForUser(true, true)).toBe(false)
    expect(isPageEditableForUser(false, false)).toBe(false)
  })
})
