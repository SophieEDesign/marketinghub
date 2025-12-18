"use client"

import type { PageBlock } from "@/lib/interface/types"

interface DividerBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function DividerBlock({ block, isEditing = false }: DividerBlockProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-full border-t border-gray-300"></div>
    </div>
  )
}
