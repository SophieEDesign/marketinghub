import { describe, it, expect } from "vitest"
import { getRequestIp } from "@/lib/request-ip"

describe("getRequestIp", () => {
  it("uses first x-forwarded-for hop", () => {
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    })
    expect(getRequestIp(req)).toBe("203.0.113.1")
  })

  it("falls back to x-real-ip", () => {
    const req = new Request("http://x/", {
      headers: { "x-real-ip": "198.51.100.2" },
    })
    expect(getRequestIp(req)).toBe("198.51.100.2")
  })

  it("returns unknown when no proxy headers", () => {
    expect(getRequestIp(new Request("http://x/"))).toBe("unknown")
  })
})
