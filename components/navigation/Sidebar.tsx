import { createServerSupabaseClient } from '@/lib/supabase'
import { isAdmin } from '@/lib/roles'
import { getTables } from '@/lib/navigation'
import InterfaceSection from './InterfaceSection'
import TableSection from './TableSection'
import SidebarItem from './SidebarItem'

export default async function Sidebar() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Check if user is admin - tables are admin-only
  const userIsAdmin = await isAdmin()

  // Load interface groups (interfaces) and their pages
  // This is the ONLY navigation source - no legacy systems
  let interfaceGroups: Array<{ 
    id: string
    name: string
    order_index: number
    collapsed: boolean
  }> = []
  
  let interfacePagesByGroup: Map<string, Array<{ 
    id: string
    name: string
    order_index: number
  }>> = new Map()
  
  try {
    // Load interface groups (interfaces) - try with is_system first, fallback if column doesn't exist
    let groupsQuery = supabase
      .from('interface_groups')
      .select('id, name, order_index, collapsed, is_system')
      .order('order_index', { ascending: true })
    
    const { data: groupsData, error: groupsError } = await groupsQuery
    
    // If is_system column doesn't exist, try without it
    if (groupsError && (groupsError.code === '42703' || groupsError.message?.includes('column "is_system" does not exist'))) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('interface_groups')
        .select('id, name, order_index, collapsed')
        .order('order_index', { ascending: true })
      
      if (!fallbackError && fallbackData) {
        interfaceGroups = fallbackData
          .filter(g => g.name !== 'Ungrouped') // Filter out "Ungrouped" by name if is_system doesn't exist
          .map(g => ({
            id: g.id,
            name: g.name,
            order_index: g.order_index || 0,
            collapsed: g.collapsed || false,
          }))
      } else if (fallbackError) {
        console.error('Error loading interface groups:', fallbackError)
      }
    } else if (!groupsError && groupsData) {
      // Filter out system groups (like "Ungrouped") from display
      interfaceGroups = groupsData
        .filter(g => !g.is_system)
        .map(g => ({
          id: g.id,
          name: g.name,
          order_index: g.order_index || 0,
          collapsed: g.collapsed || false,
        }))
    } else if (groupsError) {
      console.error('Error loading interface groups:', groupsError)
    }

    // Load interface pages - these are the ONLY navigable items
    let pagesQuery = supabase
      .from('interface_pages')
      .select('id, name, group_id, order_index, is_admin_only')
      .order('order_index', { ascending: true })
    
    // Filter out admin-only pages for non-admin users
    if (!userIsAdmin) {
      pagesQuery = pagesQuery.or('is_admin_only.is.null,is_admin_only.eq.false')
    }
    
    const { data: pagesData, error: pagesError } = await pagesQuery
    
    if (pagesError) {
      console.error('Error loading interface pages:', pagesError)
    } else if (pagesData) {
      // Group pages by group_id (interface)
      pagesData.forEach((page) => {
        const groupId = page.group_id
        if (groupId) {
          if (!interfacePagesByGroup.has(groupId)) {
            interfacePagesByGroup.set(groupId, [])
          }
          interfacePagesByGroup.get(groupId)!.push({
            id: page.id,
            name: page.name,
            order_index: page.order_index || 0,
          })
        }
      })
    }
  } catch (error) {
    console.error('Error loading interfaces:', error)
  }

  // Load tables for admin-only section
  let tables: Array<{ id: string; name: string; supabase_table: string }> = []
  if (userIsAdmin) {
    try {
      tables = await getTables()
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }

  return (
    <div className="flex h-full w-[260px] flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <h2 className="text-lg font-semibold">Marketing Hub</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Actions */}
        <div className="space-y-1 mb-4">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Actions
          </div>
          <SidebarItem
            id="import-csv"
            label="Import CSV"
            href="/import"
            icon="upload"
          />
          <SidebarItem
            id="settings"
            label="Settings"
            href="/settings"
            icon="settings"
          />
        </div>

        {/* Interfaces Section - Primary Navigation */}
        {interfaceGroups.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Interfaces
            </div>
            {interfaceGroups
              .filter((group) => {
                // Show groups that have pages, or empty groups for admins
                const pages = interfacePagesByGroup.get(group.id) || []
                return pages.length > 0 || userIsAdmin
              })
              .map((group) => {
                const pages = interfacePagesByGroup.get(group.id) || []
                
                return (
                  <InterfaceSection
                    key={group.id}
                    interfaceId={group.id}
                    interfaceName={group.name}
                    pages={pages}
                    defaultCollapsed={group.collapsed}
                    isAdmin={userIsAdmin}
                  />
                )
              })}
          </div>
        )}

        {/* Empty State - No Interfaces */}
        {interfaceGroups.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            <p className="mb-2">No interfaces yet</p>
            {userIsAdmin && (
              <p className="text-xs">Create interfaces and pages in Settings</p>
            )}
          </div>
        )}

        {/* Admin / Data Section - Admin Only */}
        {userIsAdmin && tables.length > 0 && (
          <div className="space-y-1 mt-6 border-t pt-4">
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Admin / Data
            </div>
            {tables.map((table) => (
              <TableSection
                key={table.id}
                tableId={table.id}
                tableName={table.name}
                views={[]} // Views are internal-only, not shown
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
