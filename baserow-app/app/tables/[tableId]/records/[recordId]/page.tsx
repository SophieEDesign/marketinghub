import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import RecordPageClient from "@/components/records/RecordPageClient"

export default async function RecordPage({
  params,
}: {
  params: Promise<{ tableId: string; recordId: string }>
}) {
  const { tableId, recordId } = await params
  const supabase = await createClient()

  // Verify table exists
  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("id, name, supabase_table")
    .eq("id", tableId)
    .single()

  if (tableError || !table) {
    redirect("/")
  }

  // Verify record exists
  const { data: record, error: recordError } = await supabase
    .from(table.supabase_table)
    .select("id")
    .eq("id", recordId)
    .single()

  if (recordError || !record) {
    redirect(`/tables/${tableId}`)
  }

  return (
    <WorkspaceShellWrapper title={`${table.name} - Record`}>
      <RecordPageClient
        tableId={tableId}
        recordId={recordId}
        tableName={table.name}
        supabaseTableName={table.supabase_table}
      />
    </WorkspaceShellWrapper>
  )
}

