"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, Lock } from "lucide-react"
import {
  authErrorToMessage,
  validateEmail,
  performPostAuthRedirect,
} from "@/lib/auth-utils"
import ThemeToggle from "@/components/layout/ThemeToggle"
import LoginLayout from "@/components/shell/LoginLayout"

const DEFAULT_PRIMARY = "#1e3a5f"

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
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_PRIMARY)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const response = await fetch("/api/workspace-settings")
        if (response.ok) {
          const result = await response.json()
          if (result.settings) {
            if (result.settings.brand_name) setBrandName(result.settings.brand_name)
            if (result.settings.logo_url) setLogoUrl(result.settings.logo_url)
            if (result.settings.primary_color) {
              setPrimaryColor(result.settings.primary_color)
            }
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Could not load branding:", err)
        }
      }
    }
    loadBranding()
  }, [])

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await performPostAuthRedirect(supabase, searchParams, {
            checkPasswordSetup: true,
          })
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Error checking user:", err)
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

    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || "Invalid email")
      setLoading(false)
      return
    }

    if (!password || password.length === 0) {
      setPasswordError("Password is required")
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(authErrorToMessage(signInError, "signIn"))
      setLoading(false)
    } else {
      await performPostAuthRedirect(supabase, searchParams, {
        checkPasswordSetup: true,
        onError: (errorMsg) => {
          setError(errorMsg)
          setLoading(false)
        },
      })
    }
  }

  const buttonStyle = {
    backgroundColor: primaryColor.startsWith("#") || primaryColor.startsWith("rgb")
      ? primaryColor
      : DEFAULT_PRIMARY,
    borderColor: primaryColor.startsWith("#") || primaryColor.startsWith("rgb")
      ? primaryColor
      : DEFAULT_PRIMARY,
  }

  if (checkingAuth) {
    return (
      <LoginLayout
        brandName={brandName}
        logoUrl={logoUrl}
        brandHeading="Welcome to your Marketing Hub"
      >
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      </LoginLayout>
    )
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <LoginLayout
        brandName={brandName}
        logoUrl={logoUrl}
        brandHeading="Welcome to your Marketing Hub"
      >
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Sign in to your account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your credentials to access your workspace
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                      setEmailError(validation.error || "Invalid email")
                    }
                  }}
                  required
                  className={`pl-10 ${emailError ? "border-destructive" : ""}`}
                />
              </div>
              {emailError && <p className="text-sm text-destructive">{emailError}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <a
                  href="#"
                  className="text-xs text-hub-primary hover:underline"
                  onClick={(e) => e.preventDefault()}
                  title="Contact your administrator to reset your password"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  className={`pl-10 ${passwordError ? "border-destructive" : ""}`}
                />
              </div>
              {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full text-white hover:opacity-90"
              style={buttonStyle}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-hub-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full border-hub-border"
              disabled
              title="Contact your administrator"
            >
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-hub-border"
              disabled
              title="Contact your administrator"
            >
              Microsoft
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <span className="text-hub-primary font-medium">Contact your admin</span>
          </p>
        </div>
      </LoginLayout>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoginLayout
          brandName="Marketing Hub"
          brandHeading="Welcome to your Marketing Hub"
        >
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        </LoginLayout>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
