"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const COMMON_ICONS = [
  '📊', '📈', '📉', '📋', '📝', '📄', '📑', '📌',
  '🎯', '✅', '⭐', '🔥', '💡', '🚀', '⚡', '🎨',
  '🏠', '👥', '💼', '📦', '🛒', '💰', '📧', '📱',
  '🔔', '🔒', '🔓', '⚙️', '🎛️', '📊', '📈', '📉',
  '📅', '⏰', '🗓️', '📆', '📌', '📍', '🗺️', '🌐',
  '💬', '💭', '📢', '📣', '🔍', '🔎', '📸', '🎬',
  '🎵', '🎶', '🎤', '🎧', '📺', '📻', '🎮', '🎲',
  '🏆', '🎖️', '🏅', '🥇', '🥈', '🥉', '🎁', '🎀',
  '📚', '📖', '📗', '📘', '📙', '📕', '📓', '📔',
]

interface IconPickerProps {
  value?: string
  onChange: (icon: string) => void
  placeholder?: string
  className?: string
}

export function IconPicker({ value = '', onChange, placeholder = '📊', className }: IconPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="text-xl mr-2">{value || placeholder}</span>
          <span className="text-sm text-muted-foreground">
            {value ? 'Change icon' : 'Select icon'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-2">
          <div className="text-sm font-medium mb-3">Select an icon</div>
          <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto">
            {COMMON_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onChange(emoji)
                  setOpen(false)
                }}
                className={cn(
                  "w-10 h-10 flex items-center justify-center text-xl rounded-md hover:bg-gray-100 transition-colors",
                  value === emoji && "bg-blue-100 ring-2 ring-blue-500"
                )}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Clear icon
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
