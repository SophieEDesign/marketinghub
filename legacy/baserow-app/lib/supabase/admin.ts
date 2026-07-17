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

  // Trim whitespace and newlines that might be accidentally included
  const trimmedKey = supabaseServiceRoleKey.trim()

  // Validate that it's not the anon key (service role keys are longer and start with 'eyJ')
  // Service role keys are typically 200+ characters, but we'll use 100 as a safe minimum
  // Also check that it starts with 'eyJ' which is the base64 encoding of '{"' (JWT header)
  if (trimmedKey.length < 100) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY appears to be invalid. Service role keys are long JWT tokens (typically 200+ characters). ` +
      `Your key is ${trimmedKey.length} characters. Make sure you copied the "service_role" key (NOT the anon key) from Supabase Settings → API. ` +
      `If the key is correct, ensure it's properly set in Vercel environment variables and redeploy.`
    )
  }

  // Additional validation: JWT tokens start with 'eyJ' (base64 for '{"')
  if (!trimmedKey.startsWith('eyJ')) {
    console.warn('Service role key does not start with "eyJ" - this may indicate an invalid key format')
  }

  return createClient(supabaseUrl, trimmedKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

