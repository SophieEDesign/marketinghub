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
    icon?: string | null
  }> = []
  
  let interfacePagesByGroup: Map<string, Array<{ 
    id: string
    name: string
    order_index: number
  }>> = new Map()
  
  try {
    // Load interface groups (interfaces) - try with is_system and is_admin_only first, fallback if columns don't exist
    let groupsQuery = supabase
      .from('interface_groups')
      .select('id, name, order_index, collapsed, is_system, is_admin_only, icon')
      .order('order_index', { ascending: true })
    
    const { data: groupsData, error: groupsError } = await groupsQuery
    
    // Load interface pages FIRST - we need this to determine which groups to show
    let pagesQuery = supabase
      .from('interface_pages')
      .select('id, name, group_id, order_index, is_admin_only')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true }) // Secondary sort for consistency
    
    // Filter out admin-only pages for non-admin users
    if (!userIsAdmin) {
      pagesQuery = pagesQuery.or('is_admin_only.is.null,is_admin_only.eq.false')
    }
    
    const { data: pagesData, error: pagesError } = await pagesQuery
    
    if (pagesError) {
      console.error('Error loading interface pages:', pagesError)
    } else if (pagesData) {
      // Group pages by group_id (interface)
      // Pages without group_id will be added to a special "Ungrouped" section
      const ungroupedPages: Array<{ id: string; name: string; order_index: number }> = []
      
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
        } else {
          // Pages without group_id go to ungrouped section
          ungroupedPages.push({
            id: page.id,
            name: page.name,
            order_index: page.order_index || 0,
          })
        }
      })
      
      // Add ungrouped pages to a special key if any exist
      if (ungroupedPages.length > 0) {
        interfacePagesByGroup.set('__ungrouped__', ungroupedPages)
      }
    }

    // Now filter groups based on whether they have pages and permissions
    // Include system groups ONLY if they have pages assigned
    if (groupsError && (groupsError.code === '42703' || groupsError.message?.includes('column'))) {
      // Fallback: columns don't exist, try without them
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('interface_groups')
        .select('id, name, order_index, collapsed, is_admin_only, icon')
        .order('order_index', { ascending: true })
      
      if (!fallbackError && fallbackData) {
        interfaceGroups = fallbackData
          .filter(g => {
            // Filter admin-only interfaces for non-admins
            if (!userIsAdmin && g.is_admin_only) {
              return false
            }
            // Include groups that have pages (or if name is "Ungrouped" and we have ungrouped pages)
            const hasPages = interfacePagesByGroup.has(g.id)
            const isUngrouped = g.name === 'Ungrouped'
            const hasUngroupedPages = interfacePagesByGroup.has('__ungrouped__')
            return hasPages || (isUngrouped && hasUngroupedPages)
          })
          .map(g => ({
            id: g.id,
            name: g.name,
            order_index: g.order_index || 0,
            collapsed: g.collapsed || false,
            icon: g.icon || null,
          }))
      } else if (fallbackError) {
        console.error('Error loading interface groups:', fallbackError)
      }
    } else if (!groupsError && groupsData) {
      interfaceGroups = groupsData
        .filter(g => {
          // Include non-system groups (with permission check)
          if (!g.is_system) {
            // Filter admin-only interfaces for non-admins
            return userIsAdmin || !g.is_admin_only
          }
          // For system groups, only include if they have pages assigned
          const hasPages = interfacePagesByGroup.has(g.id)
          return hasPages
        })
        .map(g => ({
          id: g.id,
          name: g.name,
          order_index: g.order_index || 0,
          collapsed: g.collapsed || false,
          icon: g.icon || null,
        }))
    } else if (groupsError) {
      console.error('Error loading interface groups:', groupsError)
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
        {(interfaceGroups.length > 0 || interfacePagesByGroup.has('__ungrouped__')) && (
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
                    icon={group.icon}
                  />
                )
              })}
            {/* Ungrouped Pages Section */}
            {interfacePagesByGroup.has('__ungrouped__') && (
              <InterfaceSection
                key="__ungrouped__"
                interfaceId="__ungrouped__"
                interfaceName="Ungrouped"
                pages={interfacePagesByGroup.get('__ungrouped__') || []}
                defaultCollapsed={false}
                isAdmin={userIsAdmin}
              />
            )}
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
