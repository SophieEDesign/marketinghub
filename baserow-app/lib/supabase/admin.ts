import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase admin client using the service role key
 * This should ONLY be used in server-side API routes
 * NEVER expose the service role key to the client
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable. This is required for user management operations.')
  }

  // Validate that it's not the anon key (service role keys are longer and start with 'eyJ')
  if (supabaseServiceRoleKey.length < 100) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY appears to be invalid. Service role keys are long JWT tokens. Make sure you copied the "service_role" key (NOT the anon key) from Supabase Settings → API.')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

