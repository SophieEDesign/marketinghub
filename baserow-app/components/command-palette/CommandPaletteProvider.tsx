"use client"

import CommandPalette from "./CommandPalette"
import { CommandPaletteProvider as CommandPaletteContextProvider, useCommandPalette } from "@/contexts/CommandPaletteContext"

function CommandPaletteDialog() {
  const ctx = useCommandPalette()
  if (!ctx) return null
  return <CommandPalette open={ctx.open} onOpenChange={ctx.setOpen} />
}

export default function CommandPaletteProvider({ children }: { children?: React.ReactNode }) {
  return (
    <CommandPaletteContextProvider>
      {children}
      <CommandPaletteDialog />
    </CommandPaletteContextProvider>
  )
}

