"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  authErrorToMessage,
  getAuthErrorMessage, // Deprecated, but kept for backward compatibility
  getRedirectUrl, 
  validateEmail, 
  validatePassword,
  performPostAuthRedirect
} from "@/lib/auth-utils"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [brandName, setBrandName] = useState<string>("Marketing Hub")
  const [primaryColor, setPrimaryColor] = useState<string>("hsl(222.2, 47.4%, 11.2%)")
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Load branding from workspace settings via API (works for unauthenticated users)
  useEffect(() => {
    const loadBranding = async () => {
      try {
        const response = await fetch('/api/workspace-settings')
        if (response.ok) {
          const result = await response.json()
          if (result.settings) {
            if (result.settings.brand_name) setBrandName(result.settings.brand_name)
            if (result.settings.logo_url) setLogoUrl(result.settings.logo_url)
            if (result.settings.primary_color) setPrimaryColor(result.settings.primary_color)
          }
        }
      } catch (err) {
        // Silently fail - use defaults
        if (process.env.NODE_ENV === 'development') {
          console.warn('Could not load branding:', err)
        }
      }
    }
    
    loadBranding()
  }, [])
  
  // Check for error message from URL (e.g., from email confirmation failure)
  // Error messages from URL are already user-friendly (mapped by authErrorToMessage)
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  // Redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Use centralized redirect function
          await performPostAuthRedirect(supabase, searchParams, {
            checkPasswordSetup: true
          })
        }
      } catch (err) {
        // Error checking user - allow login form to show
        if (process.env.NODE_ENV === 'development') {
          console.warn('Error checking user:', err)
        }
      } finally {
        setCheckingAuth(false)
      }
    }
    checkUser()
  }, [router, searchParams])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setEmailError(null)
    setPasswordError(null)

    // Validate inputs
    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || 'Invalid email')
      setLoading(false)
      return
    }

    if (!password || password.length === 0) {
      setPasswordError('Password is required')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError(authErrorToMessage(error, 'signIn'))
      setLoading(false)
    } else {
      // Wait for session using auth state listener, then redirect
      // This eliminates race conditions and arbitrary delays
      await performPostAuthRedirect(supabase, searchParams, {
        checkPasswordSetup: true,
        onError: (errorMsg) => {
          setError(errorMsg)
          setLoading(false)
        }
      })
      // Note: If redirect succeeds, component will unmount, so setLoading won't be called
      // If there's an error, onError callback handles it
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setEmailError(null)
    setPasswordError(null)

    // Validate inputs
    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || 'Invalid email')
      setLoading(false)
      return
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.error || 'Invalid password')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    if (error) {
      setError(authErrorToMessage(error, 'signUp'))
      setLoading(false)
    } else {
      // For sign up, user may need to confirm email first
      // Wait for session using auth state listener with shorter timeout
      await performPostAuthRedirect(supabase, searchParams, {
        checkPasswordSetup: true,
        onError: (errorMsg) => {
          // If session not established, likely email confirmation required
          if (errorMsg.includes('timed out') || errorMsg.includes('not established')) {
            setError('Please check your email to confirm your account before signing in.')
          } else {
            setError(errorMsg)
          }
          setLoading(false)
        }
      })
      // Note: If redirect succeeds, component will unmount
      // If there's an error, onError callback handles it
    }
  }

  // Show loading state during initial auth check
  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {logoUrl && (
            <div className="flex justify-center mb-4">
              <div className="relative h-12 w-12">
                <Image
                  src={logoUrl}
                  alt={brandName}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          )}
          <CardTitle>{brandName}</CardTitle>
          <CardDescription>Enter your credentials to access your workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError(null)
                }}
                onBlur={() => {
                  const validation = validateEmail(email)
                  if (!validation.valid) {
                    setEmailError(validation.error || 'Invalid email')
                  }
                }}
                required
                className={emailError ? 'border-destructive' : ''}
              />
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) setPasswordError(null)
                }}
                required
                className={passwordError ? 'border-destructive' : ''}
              />
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                onClick={handleSignIn}
                disabled={loading}
                className="flex-1 text-white"
                style={{ 
                  backgroundColor: primaryColor,
                  borderColor: primaryColor,
                  color: 'white',
                }}
                onMouseEnter={(e) => {
                  // Darken on hover (reduce lightness by 10%)
                  const hslMatch = primaryColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
                  if (hslMatch) {
                    const [, h, s, l] = hslMatch
                    const newL = Math.max(0, parseInt(l) - 10)
                    e.currentTarget.style.backgroundColor = `hsl(${h}, ${s}%, ${newL}%)`
                    e.currentTarget.style.borderColor = `hsl(${h}, ${s}%, ${newL}%)`
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = primaryColor
                  e.currentTarget.style.borderColor = primaryColor
                }}
              >
                Sign In
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSignUp}
                disabled={loading}
                className="flex-1"
              >
                Sign Up
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
