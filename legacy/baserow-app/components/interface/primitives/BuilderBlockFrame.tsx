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
  /** Single full-page block layout — use inset ring so outline is not clipped by overflow-hidden parents */
  isFullPageLayout?: boolean
  className?: string
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  children: ReactNode
}

export function builderBlockFrameClassName({
  isEditing,
  isSelected,
  isSnapHighlighted,
  isKeyboardHighlighted,
  isFullPageLayout = false,
}: Pick<
  BuilderBlockFrameProps,
  | "isEditing"
  | "isSelected"
  | "isSnapHighlighted"
  | "isKeyboardHighlighted"
  | "isFullPageLayout"
>): string {
  if (!isEditing || isFullPageLayout) {
    return cn(
      "block-container relative h-full w-full min-h-0",
      BUILDER_CHROME_FRAME_VIEW,
      isEditing &&
        isFullPageLayout &&
        isSelected &&
        "ring-2 ring-inset ring-accent-link/35 border border-accent-link/40",
      isEditing && isFullPageLayout && isSnapHighlighted && BUILDER_CHROME_FRAME_SNAP,
      isEditing && isFullPageLayout && isKeyboardHighlighted && BUILDER_CHROME_FRAME_KEYBOARD
    )
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
  isFullPageLayout,
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
          isFullPageLayout,
        }),
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
