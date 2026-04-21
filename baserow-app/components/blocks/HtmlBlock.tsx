"use client"

import { useEffect, useMemo, useState } from "react"
import type { ViewBlock } from "@/types/database"
import { createClient } from "@/lib/supabase/client"
import { sanitizeHtmlBlock } from "@/lib/sanitize"

interface HtmlBlockProps {
  block: ViewBlock
}

export default function HtmlBlock({ block }: HtmlBlockProps) {
  const html = block.config?.html || ""
  const [userFirstName, setUserFirstName] = useState("there")
  const [userFullName, setUserFullName] = useState("there")

  useEffect(() => {
    let cancelled = false
    const loadUserName = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!user || cancelled) return

        const md = (user.user_metadata || {}) as Record<string, unknown>
        const full =
          (typeof md.full_name === "string" && md.full_name.trim()) ||
          (typeof md.name === "string" && md.name.trim()) ||
          (typeof md.display_name === "string" && md.display_name.trim()) ||
          ""
        const first =
          (typeof md.first_name === "string" && md.first_name.trim()) ||
          (full ? full.split(" ")[0] : "")

        if (!cancelled) {
          setUserFirstName(first || "there")
          setUserFullName(full || first || "there")
        }
      } catch {
        if (!cancelled) {
          setUserFirstName("there")
          setUserFullName("there")
        }
      }
    }
    void loadUserName()
    return () => {
      cancelled = true
    }
  }, [])

  const resolvedHtml = useMemo(() => {
    return html
      .replace(/\{\{\s*user_first_name\s*\}\}/g, userFirstName)
      .replace(/\{\{\s*user_name\s*\}\}/g, userFullName)
  }, [html, userFirstName, userFullName])

  return (
    <div className="w-full h-full">
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlBlock(resolvedHtml) }} />
    </div>
  )
}
