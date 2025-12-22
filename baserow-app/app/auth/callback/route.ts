import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Successfully confirmed email and created session
      // Redirect to home page
      return NextResponse.redirect(new URL(next, request.url))
    } else {
      // Error confirming email
      console.error('Error confirming email:', error)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url))
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(new URL('/login', request.url))
}
