"use client"

import { useState } from "react"
import CommandPalette from "./CommandPalette"

export default function CommandPaletteProvider() {
  const [open, setOpen] = useState(false)

  return <CommandPalette open={open} onOpenChange={setOpen} />
}

