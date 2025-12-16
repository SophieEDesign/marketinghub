import { getTables } from "@/lib/crud/tables"
import { getViews } from "@/lib/crud/views"
import { getInterfacePages } from "@/lib/crud/pages"
import { getDashboards } from "@/lib/crud/dashboards"
import { getUserRole } from "@/lib/roles"
import WorkspaceShell from "./WorkspaceShell"
import type { View } from "@/types/database"

interface WorkspaceShellWrapperProps {
  children: React.ReactNode
  title?: string
}

export default async function WorkspaceShellWrapper({
  children,
  title,
}: WorkspaceShellWrapperProps) {
  // Fetch all data in parallel
  const [tables, userRole] = await Promise.all([
    getTables().catch(() => []),
    getUserRole(),
  ])

  // Fetch views for all tables
  const viewsByTable: Record<string, View[]> = {}
  await Promise.all(
    tables.map(async (table) => {
      try {
        const tableViews = await getViews(table.id)
        viewsByTable[table.id] = tableViews
      } catch {
        viewsByTable[table.id] = []
      }
    })
  )

  // Fetch interface pages and dashboards
  const [interfacePages, dashboards] = await Promise.all([
    getInterfacePages().catch(() => []),
    getDashboards().catch(() => []),
  ])

  return (
    <WorkspaceShell
      title={title}
      tables={tables}
      views={viewsByTable}
      interfacePages={interfacePages}
      dashboards={dashboards}
      userRole={userRole}
    >
      {children}
    </WorkspaceShell>
  )
}
