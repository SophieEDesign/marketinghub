"use client"

import { Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface TopbarProps {
  title?: string
}

export default function Topbar({ title = "Marketing Hub" }: TopbarProps) {
  return (
    <div className="h-14 border-b bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Search placeholder */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-9 w-64 h-9 bg-gray-50 border-gray-200"
            disabled
          />
        </div>
        
        {/* User avatar dropdown placeholder */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 rounded-full p-0"
        >
          <User className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
