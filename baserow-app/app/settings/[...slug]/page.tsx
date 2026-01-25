import { redirect } from 'next/navigation'

/**
 * Catch-all route for /settings/* subroutes
 * 
 * This handles any invalid settings subroutes (like /settings/logs)
 * and redirects them back to the main settings page.
 * 
 * Routes that should exist:
 * - /settings (handled by page.tsx)
 * 
 * All other /settings/* routes will be caught here and redirected.
 */
export default function SettingsCatchAll({
  params,
}: {
  params: { slug?: string[] }
}) {
  // Log for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[SettingsCatchAll] Caught invalid route:', params.slug)
  }
  
  // Redirect any unknown settings routes back to the main settings page
  redirect('/settings')
}
