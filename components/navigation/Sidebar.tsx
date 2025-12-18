import { createServerSupabaseClient } from '@/lib/supabase'
import {
  getSidebarCategories,
  getSidebarItems,
  getTablesWithViews,
  getDashboardViews,
  ensureSidebarItemsForTables,
  ensureDashboardsCategory,
  getUserRoles,
} from '@/lib/navigation'
import SidebarCategory from './SidebarCategory'
import SidebarItem from './SidebarItem'
import TableSection from './TableSection'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Upload } from 'lucide-react'

export default async function Sidebar() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Ensure sidebar items exist for all tables
  await ensureSidebarItemsForTables()
  await ensureDashboardsCategory()

  // Load sidebar structure
  const categories = await getSidebarCategories()
  const sidebarItems = await getSidebarItems()
  const userRoles = await getUserRoles(user.id)

  // Load tables with views
  const tablesWithViews = await getTablesWithViews(user.id)

  // Load dashboard views
  const dashboardViews = await getDashboardViews()
  const visibleDashboards = dashboardViews.filter((view) => {
    if (view.access_level === 'public') return true
    if (view.access_level === 'authenticated') return true
    if (view.access_level === 'owner') {
      if (view.allowed_roles && view.allowed_roles.length > 0) {
        return view.allowed_roles.some((role) => userRoles.includes(role))
      }
      return true
    }
    return false
  })

  // Get dashboards category
  const dashboardsCategory = categories.find((c) => c.name === 'Dashboards')

  // Group items by category
  const itemsByCategory = new Map<string | null, typeof sidebarItems>()
  sidebarItems.forEach((item) => {
    const key = item.category_id || null
    if (!itemsByCategory.has(key)) {
      itemsByCategory.set(key, [])
    }
    itemsByCategory.get(key)!.push(item)
  })

  // Get tables from sidebar items
  const tableItems = sidebarItems.filter((item) => item.item_type === 'table')

  return (
    <div className="flex h-full w-[260px] flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <h2 className="text-lg font-semibold">Marketing Hub</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Actions */}
        <div className="space-y-1">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Actions
          </div>
          <SidebarItem
            id="import-csv"
            label="Import CSV"
            href="/import"
            icon="upload"
          />
        </div>

        {/* Render categories with their items */}
        {categories
          .filter((category) => category.name !== 'Dashboards') // Dashboards handled separately
          .sort((a, b) => a.position - b.position)
          .map((category) => {
            const categoryItems = (itemsByCategory.get(category.id) || []).sort(
              (a, b) => a.position - b.position
            )
            if (categoryItems.length === 0) return null
            return (
              <SidebarCategory
                key={category.id}
                id={category.id}
                name={category.name}
                icon={category.icon}
                items={categoryItems.map((item) => ({
                  id: item.id,
                  label: item.label,
                  href: item.href,
                  icon: item.icon,
                }))}
              />
            )
          })}

        {/* Dashboards Category */}
        {dashboardsCategory && (
          <SidebarCategory
            id={dashboardsCategory.id}
            name={dashboardsCategory.name}
            icon={dashboardsCategory.icon}
            items={visibleDashboards.map((view) => {
              // Find table for this view
              const table = tablesWithViews.find((t) => t.id === view.table_id)
              return {
                id: view.id,
                label: view.name,
                href: table ? `/data/${table.id}/views/${view.id}` : '#',
                icon: 'layout-dashboard',
              }
            })}
          >
            <div className="pl-6">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href="/data/dashboards/new">
                  <Plus className="mr-2 h-3 w-3" />
                  Create Dashboard
                </Link>
              </Button>
            </div>
          </SidebarCategory>
        )}

        {/* Tables Section - from sidebar_items */}
        {tableItems.length > 0 && (
          <div className="space-y-1">
            {tableItems
              .sort((a, b) => a.position - b.position)
              .map((item) => {
                const table = tablesWithViews.find((t) => t.id === item.item_id)
                if (!table) return null

                const tableViews = table.views.filter((v) => v.type !== 'page')

                return (
                  <TableSection
                    key={item.id}
                    tableId={table.id}
                    tableName={table.name}
                    views={tableViews}
                  />
                )
              })}
          </div>
        )}

        {/* Uncategorized items */}
        {itemsByCategory.has(null) && (
          <div className="space-y-1">
            {itemsByCategory
              .get(null)!
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <SidebarItem
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

