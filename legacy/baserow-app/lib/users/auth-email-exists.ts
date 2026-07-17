import type { SupabaseClient } from "@supabase/supabase-js"

/** Check if an email already has a Supabase Auth account (paginated listUsers). */
export async function authEmailExists(
  adminClient: SupabaseClient,
  email: string
): Promise<boolean> {
  const target = email.trim().toLowerCase()
  let page = 1

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error || !data?.users?.length) {
      return false
    }
    if (data.users.some((u) => u.email?.toLowerCase() === target)) {
      return true
    }
    if (data.users.length < 1000) {
      return false
    }
    page += 1
  }
}
