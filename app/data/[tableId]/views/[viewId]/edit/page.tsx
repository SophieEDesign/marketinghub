import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { loadView } from '@/lib/views'
import ViewEditForm from '@/components/views/ViewEditForm'

export default async function EditViewPage({
  params,
}: {
  params: { tableId: string; viewId: string }
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const view = await loadView(params.viewId)
  if (!view) {
    return <div>View not found</div>
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Edit View: {view.name}</h1>
      <ViewEditForm view={view} tableId={params.tableId} />
    </div>
  )
}
