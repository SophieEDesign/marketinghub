"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  authErrorToMessage,
  getAuthErrorMessage, // Deprecated, but kept for backward compatibility
  getRedirectUrl, 
  validateEmail, 
  performPostAuthRedirect
} from "@/lib/auth-utils"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [brandName, setBrandName] = useState<string>("Marketing Hub")
  const [primaryColor, setPrimaryColor] = useState<string>("hsl(222.2, 47.4%, 11.2%)")
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("")
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false)
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null)
  const [showAccessRequest, setShowAccessRequest] = useState(false)
  const [accessName, setAccessName] = useState("")
  const [accessEmail, setAccessEmail] = useState("")
  const [accessDetails, setAccessDetails] = useState("")
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessSent, setAccessSent] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
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
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotPasswordLoading(true)
    setForgotPasswordError(null)
    const emailValidation = validateEmail(forgotPasswordEmail)
    if (!emailValidation.valid) {
      setForgotPasswordError(emailValidation.error || "Invalid email")
      setForgotPasswordLoading(false)
      return
    }
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/auth/update-password`
      : "/auth/update-password"
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail.trim(), { redirectTo })
    if (error) {
      setForgotPasswordError(authErrorToMessage(error, "resetPassword"))
      setForgotPasswordLoading(false)
    } else {
      setForgotPasswordSent(true)
      setForgotPasswordLoading(false)
    }
  }

  const handleAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccessLoading(true)
    setAccessError(null)
    const emailValidation = validateEmail(accessEmail)
    if (!emailValidation.valid) {
      setAccessError(emailValidation.error || "Invalid email")
      setAccessLoading(false)
      return
    }
    if (!accessName.trim()) {
      setAccessError("Name is required")
      setAccessLoading(false)
      return
    }
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accessName.trim(),
          email: accessEmail.trim(),
          details: accessDetails.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAccessError(data.error || "Failed to send request")
        setAccessLoading(false)
        return
      }
      setAccessSent(true)
      setAccessName("")
      setAccessEmail("")
      setAccessDetails("")
    } catch (err) {
      setAccessError("Failed to send request. Please try again.")
    }
    setAccessLoading(false)
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
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(!showForgotPassword)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) setPasswordError(null)
                  }}
                  required
                  className={`pr-10 ${passwordError ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              {showForgotPassword && (
                <div className="rounded-md border p-3 mt-2 space-y-2">
                  <p className="text-sm text-muted-foreground">Enter your email to receive a password reset link.</p>
                  {forgotPasswordSent ? (
                    <p className="text-sm text-green-600 dark:text-green-400">Check your email for a reset link.</p>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={forgotPasswordEmail}
                        onChange={(e) => {
                          setForgotPasswordEmail(e.target.value)
                          setForgotPasswordError(null)
                        }}
                        className="flex-1"
                        disabled={forgotPasswordLoading}
                      />
                      <Button type="submit" variant="outline" size="sm" disabled={forgotPasswordLoading}>
                        {forgotPasswordLoading ? "Sending…" : "Send link"}
                      </Button>
                    </form>
                  )}
                  {forgotPasswordError && (
                    <p className="text-sm text-destructive">{forgotPasswordError}</p>
                  )}
                </div>
              )}
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div>
              <Button
                type="submit"
                onClick={handleSignIn}
                disabled={loading}
                className="w-full text-white"
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
            </div>
          </form>
          <div className="mt-6 pt-6 border-t">
            <button
              type="button"
              onClick={() => setShowAccessRequest(!showAccessRequest)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Also want to access this hub?
            </button>
            {showAccessRequest && (
              <div className="mt-3 space-y-3">
                {accessSent ? (
                  <p className="text-sm text-green-600 dark:text-green-400">Request sent. We&apos;ll be in touch soon.</p>
                ) : (
                  <form onSubmit={handleAccessRequest} className="space-y-3">
                    <Input
                      placeholder="Your name"
                      value={accessName}
                      onChange={(e) => setAccessName(e.target.value)}
                      disabled={accessLoading}
                      required
                    />
                    <Input
                      type="email"
                      placeholder="Your email"
                      value={accessEmail}
                      onChange={(e) => {
                        setAccessEmail(e.target.value)
                        setAccessError(null)
                      }}
                      disabled={accessLoading}
                      required
                    />
                    <textarea
                      placeholder="Details (optional)"
                      value={accessDetails}
                      onChange={(e) => setAccessDetails(e.target.value)}
                      disabled={accessLoading}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {accessError && (
                      <p className="text-sm text-destructive">{accessError}</p>
                    )}
                    <Button type="submit" variant="outline" size="sm" disabled={accessLoading}>
                      {accessLoading ? "Sending…" : "Request access"}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
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
