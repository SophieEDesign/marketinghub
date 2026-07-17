"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import PageContainer from "./PageContainer"
import ShellPlaceholderCard from "./ShellPlaceholderCard"

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

interface ShellPagePlaceholderProps {
  pageName?: string
  showGreeting?: boolean
}

export default function ShellPagePlaceholder({
  pageName,
  showGreeting = true,
}: ShellPagePlaceholderProps) {
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const meta = user.user_metadata
      const name =
        meta?.full_name ||
        meta?.name ||
        user.email?.split("@")[0] ||
        null
      setDisplayName(name)
    })
  }, [])

  const greeting = showGreeting
    ? displayName
      ? `${getTimeGreeting()}, ${displayName}! 👋`
      : `${getTimeGreeting()}! 👋`
    : pageName

  const subtitle = showGreeting
    ? pageName
      ? `You're viewing ${pageName}.`
      : "Your marketing workspace is ready for custom dashboard blocks."
    : undefined

  return (
    <PageContainer title={greeting} subtitle={subtitle}>
      <ShellPlaceholderCard />
    </PageContainer>
  )
}
