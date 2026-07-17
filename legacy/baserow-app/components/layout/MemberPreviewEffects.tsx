"use client"

import { useEffect, useRef } from "react"
import { useMemberPreview } from "@/contexts/MemberPreviewContext"
import { useEditMode } from "@/contexts/EditModeContext"
import { useUIMode } from "@/contexts/UIModeContext"

/** Exit layout edit when member preview is enabled */
export default function MemberPreviewEffects() {
  const { isMemberPreview } = useMemberPreview()
  const { exitAllEditModes } = useEditMode()
  const { exitEditPages } = useUIMode()
  const wasPreviewRef = useRef(false)

  useEffect(() => {
    if (isMemberPreview && !wasPreviewRef.current) {
      exitAllEditModes()
      exitEditPages()
    }
    wasPreviewRef.current = isMemberPreview
  }, [isMemberPreview, exitAllEditModes, exitEditPages])

  return null
}
