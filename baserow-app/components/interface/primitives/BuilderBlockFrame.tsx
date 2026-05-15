"use client"

import type { ReactNode, MouseEvent } from "react"
import {
  BUILDER_CHROME_DRAG_HANDLE,
  BUILDER_CHROME_FRAME_BASE,
  BUILDER_CHROME_FRAME_KEYBOARD,
  BUILDER_CHROME_FRAME_SELECTED,
  BUILDER_CHROME_FRAME_SNAP,
  BUILDER_CHROME_FRAME_VIEW,
} from "@/lib/interface/spacing-tokens"
import { cn } from "@/lib/utils"

export interface BuilderBlockFrameProps {
  isEditing: boolean
  isSelected?: boolean
  isSnapHighlighted?: boolean
  isKeyboardHighlighted?: boolean
  className?: string
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  children: ReactNode
}

export function builderBlockFrameClassName({
  isEditing,
  isSelected,
  isSnapHighlighted,
  isKeyboardHighlighted,
}: Pick<
  BuilderBlockFrameProps,
  "isEditing" | "isSelected" | "isSnapHighlighted" | "isKeyboardHighlighted"
>): string {
  if (!isEditing) {
    return cn("block-container relative", BUILDER_CHROME_FRAME_VIEW)
  }

  return cn(
    "block-container relative",
    BUILDER_CHROME_FRAME_BASE,
    isSelected && BUILDER_CHROME_FRAME_SELECTED,
    isSnapHighlighted && BUILDER_CHROME_FRAME_SNAP,
    isKeyboardHighlighted && BUILDER_CHROME_FRAME_KEYBOARD
  )
}

export { BUILDER_CHROME_DRAG_HANDLE }

export default function BuilderBlockFrame({
  isEditing,
  isSelected,
  isSnapHighlighted,
  isKeyboardHighlighted,
  className,
  onClick,
  children,
}: BuilderBlockFrameProps) {
  return (
    <div
      className={cn(
        builderBlockFrameClassName({
          isEditing,
          isSelected,
          isSnapHighlighted,
          isKeyboardHighlighted,
        }),
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
