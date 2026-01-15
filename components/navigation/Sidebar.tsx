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
    icon?: string | null
  }>> = new Map()
  
  // Map to store group icons from pages (fallback if group icon is null)
  const groupIconsFromPages = new Map<string, string | null>()
  
  try {
    // Load interface groups (interfaces) - start with minimal query, then try to add optional columns
    // Start with columns that definitely exist
    let groupsQuery = supabase
      .from('interface_groups')
      .select('id, name, order_index')
      .order('order_index', { ascending: true })
    
    let groupsData: any[] | null = null
    let groupsError: any = null
    
    // Try the minimal query first
    const { data: minimalData, error: minimalError } = await groupsQuery
    
    if (minimalError) {
      groupsError = minimalError
    } else if (minimalData) {
      groupsData = minimalData
      
      // Try to fetch additional columns if they exist
      try {
        // First try without icon column to avoid 400 errors
        const { data: dataWithoutIcon, error: errorWithoutIcon } = await supabase
          .from('interface_groups')
          .select('id, name, order_index, collapsed, is_system, is_admin_only')
          .order('order_index', { ascending: true })
        
        if (!errorWithoutIcon && dataWithoutIcon) {
          // If that works, try with icon column
          try {
            const { data: fullData, error: fullError } = await supabase
              .from('interface_groups')
              .select('id, name, order_index, collapsed, is_system, is_admin_only, icon')
              .order('order_index', { ascending: true })
            
            if (!fullError && fullData) {
              groupsData = fullData
            } else {
              // Icon column doesn't exist - use data without icon
              groupsData = dataWithoutIcon.map((g: any) => ({ ...g, icon: null }))
            }
          } catch (e) {
            // Icon column doesn't exist - use data without icon
            groupsData = dataWithoutIcon.map((g: any) => ({ ...g, icon: null }))
          }
        } else {
          // Fallback to minimal data with defaults
          groupsData = minimalData.map((g: any) => ({
            ...g,
            collapsed: false,
            is_system: false,
            is_admin_only: false,
            icon: null,
          }))
        }
      } catch (e) {
        // Some columns don't exist - use minimal data and add defaults
        groupsData = minimalData.map((g: any) => ({
          ...g,
          collapsed: false,
          is_system: false,
          is_admin_only: false,
          icon: null,
        }))
      }
    }
    
    // Load interface pages FIRST - we need this to determine which groups to show
    // Also load config to get icons from pages
    let pagesQuery = supabase
      .from('interface_pages')
      .select('id, name, group_id, order_index, is_admin_only, config')
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
        // Extract icon from page config if available
        const pageIcon = (page.config as any)?.settings?.icon || null
        
        if (groupId) {
          if (!interfacePagesByGroup.has(groupId)) {
            interfacePagesByGroup.set(groupId, [])
          }
          interfacePagesByGroup.get(groupId)!.push({
            id: page.id,
            name: page.name,
            order_index: page.order_index || 0,
            icon: pageIcon,
          })
          
          // Store the first page's icon as fallback for the group
          if (pageIcon && !groupIconsFromPages.has(groupId)) {
            groupIconsFromPages.set(groupId, pageIcon)
          }
        } else {
          // Pages without group_id go to ungrouped section
          ungroupedPages.push({
            id: page.id,
            name: page.name,
            order_index: page.order_index || 0,
            icon: pageIcon,
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
    if (groupsError) {
      // If there's an error, log it but continue with empty groups
      console.error('Error loading interface groups:', groupsError)
      interfaceGroups = []
    } else if (groupsData) {
      interfaceGroups = groupsData
        .filter(g => {
          // Check if it's a system group (default to false if column doesn't exist)
          const isSystem = g.is_system === true
          
          // Include non-system groups (with permission check)
          if (!isSystem) {
            // Filter admin-only interfaces for non-admins (default to false if column doesn't exist)
            const isAdminOnly = g.is_admin_only === true
            return userIsAdmin || !isAdminOnly
          }
          // For system groups, only include if they have pages assigned
          const hasPages = interfacePagesByGroup.has(g.id)
          return hasPages
        })
        .map(g => {
          // Use group icon if available, otherwise fallback to icon from first page
          const groupIcon = g.icon || groupIconsFromPages.get(g.id) || null
          return {
            id: g.id,
            name: g.name,
            order_index: g.order_index || 0,
            collapsed: g.collapsed || false,
            icon: groupIcon,
          }
        })
    } else {
      // No data and no error - table might not exist or be empty
      interfaceGroups = []
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
    <div className="flex h-full w-[260px] flex-col border-r bg-background shadow-lg">
      <div className="flex h-16 items-center border-b px-6">
        <h2 className="text-lg font-semibold">Marketing Hub</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Actions */}
        {userIsAdmin && (
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
        )}

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
