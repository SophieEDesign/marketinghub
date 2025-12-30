import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import RecordPageClient from "@/components/records/RecordPageClient"

export default async function RecordPage({
  params,
}: {
  params: { tableId: string; recordId: string }
}) {
  const supabase = await createClient()

  // Verify table exists
  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("id, name, supabase_table")
    .eq("id", params.tableId)
    .single()

  if (tableError || !table) {
    redirect("/")
  }

  // Verify record exists
  const { data: record, error: recordError } = await supabase
    .from(table.supabase_table)
    .select("id")
    .eq("id", params.recordId)
    .single()

  if (recordError || !record) {
    redirect(`/tables/${params.tableId}`)
  }

  return (
    <WorkspaceShellWrapper title={`${table.name} - Record`}>
      <RecordPageClient
        tableId={params.tableId}
        recordId={params.recordId}
        tableName={table.name}
        supabaseTableName={table.supabase_table}
      />
    </WorkspaceShellWrapper>
  )
}

