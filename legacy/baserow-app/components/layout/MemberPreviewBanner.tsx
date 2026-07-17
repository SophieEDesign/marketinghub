"use client"

import { Eye, X } from "lucide-react"
import { useMemberPreview } from "@/contexts/MemberPreviewContext"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function MemberPreviewBanner() {
  const { isMemberPreview, setMemberPreview, userIsAdmin } = useMemberPreview()

  if (!userIsAdmin || !isMemberPreview) return null

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 sm:px-6 h-11 shrink-0",
        "bg-sky-50 border-b border-sky-200 text-sky-950"
      )}
      role="banner"
      aria-label="Member preview active"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-sky-200/80 shrink-0">
          <Eye className="h-3.5 w-3.5 text-sky-800" aria-hidden />
        </div>
        <span className="font-medium text-sm truncate">Previewing as member</span>
        <span className="hidden sm:inline text-xs text-sky-800/80 truncate">
          Admin-only pages and edits are hidden
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setMemberPreview(false)}
        className="gap-1.5 shrink-0 border-sky-300 bg-white hover:bg-sky-100 text-sky-900"
      >
        <X className="h-3.5 w-3.5" />
        Exit preview
      </Button>
    </div>
  )
}
