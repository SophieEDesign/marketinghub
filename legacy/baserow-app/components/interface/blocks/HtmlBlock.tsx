"use client"

import { useEffect, useMemo, useState } from "react"
import type { PageBlock } from "@/lib/interface/types"
import { Code } from "lucide-react"
import { sanitizeHtmlBlock } from "@/lib/sanitize"
import { createClient } from "@/lib/supabase/client"

interface HtmlBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (updates: Partial<PageBlock["config"]>) => void
}

export default function HtmlBlock({ block, isEditing = false }: HtmlBlockProps) {
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
      .replaceAll("{{user_first_name}}", userFirstName)
      .replaceAll("{{user_name}}", userFullName)
  }, [html, userFirstName, userFullName])

  if (!html) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400 min-h-[100px]">
        <div className="text-center">
          <Code className="h-8 w-8 mx-auto mb-2" />
          <p className="text-xs">No HTML content. Add HTML in the settings panel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full min-h-0 overflow-auto">
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlBlock(resolvedHtml) }} />
    </div>
  )
}
