"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { BlockConfig } from "@/lib/interface/types"
import {
  MEMBERS_WELCOME_PAGE_LINK_NAMES,
  type MembersWelcomePageLinks,
} from "@/lib/marketing/members-welcome"

function pickPageId(
  rows: Array<{ id: string; name: string }>,
  names: readonly string[],
  overrideId?: string
): string | null {
  if (overrideId) return overrideId
  for (const name of names) {
    const hit = rows.find((r) => r.name === name)
    if (hit?.id) return hit.id
  }
  return null
}

export function useMembersWelcomePageLinks(config?: BlockConfig): {
  links: MembersWelcomePageLinks
  loading: boolean
} {
  const [links, setLinks] = useState<MembersWelcomePageLinks>({
    events: null,
    resources: null,
    contacts: null,
    help: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("interface_pages")
          .select("id, name")
          .eq("is_archived", false)
          .eq("is_hidden", false)

        if (error || !data) {
          if (!cancelled) setLoading(false)
          return
        }

        const rows = data as Array<{ id: string; name: string }>
        if (cancelled) return

        setLinks({
          events: pickPageId(
            rows,
            MEMBERS_WELCOME_PAGE_LINK_NAMES.events,
            config?.members_welcome_events_page_id
          ),
          resources: pickPageId(
            rows,
            MEMBERS_WELCOME_PAGE_LINK_NAMES.resources,
            config?.members_welcome_resources_page_id
          ),
          contacts: pickPageId(
            rows,
            MEMBERS_WELCOME_PAGE_LINK_NAMES.contacts,
            config?.members_welcome_contacts_page_id
          ),
          help: pickPageId(
            rows,
            MEMBERS_WELCOME_PAGE_LINK_NAMES.help,
            config?.members_welcome_help_page_id
          ),
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    config?.members_welcome_events_page_id,
    config?.members_welcome_resources_page_id,
    config?.members_welcome_contacts_page_id,
    config?.members_welcome_help_page_id,
  ])

  return { links, loading }
}
