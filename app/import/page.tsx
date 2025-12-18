import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import ImportClient from '@/components/import/ImportClient'

export default async function ImportPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Import CSV</h1>
        <p className="text-muted-foreground">
          Upload a CSV file to create a new table in the Marketing Hub
        </p>
      </div>
      <ImportClient />
    </div>
  )
}
