"use client"

import Image from "next/image"
import type { ViewBlock } from "@/types/database"

interface ImageBlockProps {
  block: ViewBlock
}

export default function ImageBlock({ block }: ImageBlockProps) {
  const src = block.config?.src || ""
  const alt = block.config?.alt || ""

  if (!src) {
    return <div className="text-muted-foreground">No image URL provided</div>
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <Image src={src} alt={alt} width={800} height={600} className="object-contain" />
    </div>
  )
}
