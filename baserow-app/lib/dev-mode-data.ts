/**
 * Data fetching for Airtable Dev Mode.
 * Isolated from production - used only by /dev/airtable route.
 */
import { createClient } from "@/lib/supabase/server"
import { getTables } from "@/lib/crud/tables"
import { getViews } from "@/lib/crud/views"
import { isAdmin } from "@/lib/roles"
import type { View } from "@/types/database"

export interface DevModeShellData {
  interfacePages: Array<{
    id: string
    name: string
    group_id?: string | null
    order_index?: number
    is_admin_only?: boolean
    page_type?: string
    is_new_system?: boolean
  }>
  interfaceGroups: Array<{
    id: string
    name: string
    order_index: number
    collapsed: boolean
    is_system?: boolean
    is_admin_only?: boolean
    icon?: string | null
  }>
  tables: Awaited<ReturnType<typeof getTables>>
  viewsByTable: Record<string, View[]>
  userRole: "admin" | "member" | null
  isAdmin: boolean
}

export async function getDevModeShellData(): Promise<DevModeShellData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { getUserRole } = await import("@/lib/roles")
  const [tables, userRole, admin] = await Promise.all([
    getTables().catch(() => []),
    getUserRole(),
    isAdmin(),
  ])

  const viewsByTable: Record<string, View[]> = {}
  await Promise.all(
    tables.map(async (table) => {
      try {
        const tableViews = await getViews(table.id).catch(() => [])
        viewsByTable[table.id] = tableViews || []
      } catch {
        viewsByTable[table.id] = []
      }
    })
  )

  let interfaceGroups: DevModeShellData["interfaceGroups"] = []
  try {
    const { data } = await supabase
      .from("interface_groups")
      .select("id, name, order_index, collapsed, is_system, is_admin_only, icon")
      .order("order_index", { ascending: true })
    if (data) {
      interfaceGroups = (data as any[])
        .filter((g: any) => admin || !g?.is_admin_only)
        .map((g: any) => ({ ...g, collapsed: g.collapsed ?? false, icon: g.icon ?? null }))
    }
  } catch {
    // Table may not exist
  }

  let interfacePages: DevModeShellData["interfacePages"] = []
  try {
    let query = supabase
      .from("interface_pages")
      .select("id, name, page_type, group_id, order_index, is_admin_only")
      .order("order_index", { ascending: true })
    if (!admin) {
      query = query.or("is_admin_only.is.null,is_admin_only.eq.false")
    }
    const { data: newPages } = await query
    if (newPages) {
      interfacePages = newPages.map((p: any) => ({
        ...p,
        is_new_system: true,
      }))
    }
    const { data: oldPages } = await supabase
      .from("views")
      .select("id, name, type, group_id, order_index, is_admin_only")
      .eq("type", "interface")
      .order("order_index", { ascending: true })
    if (oldPages && !admin) {
      const filtered = oldPages.filter((p: any) => !p.is_admin_only)
      const existingIds = new Set(interfacePages.map((p) => p.id))
      for (const p of filtered) {
        if (!existingIds.has(p.id)) {
          interfacePages.push({ ...p, page_type: "interface", is_new_system: false })
        }
      }
    } else if (oldPages) {
      const existingIds = new Set(interfacePages.map((p) => p.id))
      for (const p of oldPages) {
        if (!existingIds.has(p.id)) {
          interfacePages.push({ ...p, page_type: "interface", is_new_system: false })
        }
      }
    }
  } catch {
    // Tables may not exist
  }

  return {
    interfacePages,
    interfaceGroups,
    tables,
    viewsByTable,
    userRole,
    isAdmin: admin,
  }
}
