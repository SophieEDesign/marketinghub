"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function DynamicTitle() {
  const pathname = usePathname()
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [pageTitle, setPageTitle] = useState<string | null>(null)

  useEffect(() => {
    // Load workspace name from settings
    async function loadWorkspaceName() {
      try {
        const supabase = createClient()
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('name')
          .eq('id', 'default')
          .maybeSingle()

        if (workspace?.name) {
          setWorkspaceName(workspace.name)
        }
      } catch (error) {
        // Workspace table might not exist or have RLS issues - ignore
        console.warn('Could not load workspace name:', error)
      }
    }

    loadWorkspaceName()
  }, [])

  // Listen for custom event to update page title
  useEffect(() => {
    const handleTitleUpdate = (event: CustomEvent<string>) => {
      setPageTitle(event.detail)
    }

    window.addEventListener('update-page-title' as any, handleTitleUpdate as EventListener)
    return () => {
      window.removeEventListener('update-page-title' as any, handleTitleUpdate as EventListener)
    }
  }, [])

  // Check for title in data attribute (set by server components)
  useEffect(() => {
    const titleElement = document.querySelector('[data-page-title]')
    if (titleElement) {
      const title = titleElement.getAttribute('data-page-title')
      if (title) {
        setPageTitle(title)
      }
    }
  }, [pathname])

  useEffect(() => {
    // Update document title
    let title = "Baserow App" // Default fallback

    if (pageTitle) {
      // If page title is provided, use it
      title = pageTitle
    } else if (workspaceName) {
      // Otherwise use workspace name
      title = workspaceName
    }

    document.title = title
  }, [pageTitle, workspaceName, pathname])

  return null // This component doesn't render anything
}

