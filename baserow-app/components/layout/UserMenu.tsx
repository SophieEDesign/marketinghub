"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Settings, LogOut, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return "?"
}

export default function UserMenu() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const meta = user.user_metadata
      setEmail(user.email ?? null)
      setDisplayName(
        meta?.full_name || meta?.name || user.email?.split("@")[0] || null
      )
      setRole(meta?.role === "admin" ? "Admin" : null)

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
      if (profile?.role === "admin") setRole("Admin")
      else if (profile?.role === "member") setRole("Member")
    }
    loadUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const initials = getInitials(displayName, email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-2 hover:bg-muted/60"
          aria-label="User menu"
        >
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              "bg-hub-nav-active text-hub-primary"
            )}
          >
            {initials}
          </span>
          <span className="hidden lg:flex flex-col items-start min-w-0 max-w-[140px]">
            <span className="truncate text-sm font-medium text-foreground leading-tight">
              {displayName ?? "Account"}
            </span>
            {role ? (
              <span className="truncate text-[11px] text-muted-foreground leading-tight">{role}</span>
            ) : null}
          </span>
          <ChevronDown className="hidden lg:block h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {email ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{email}</div>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
