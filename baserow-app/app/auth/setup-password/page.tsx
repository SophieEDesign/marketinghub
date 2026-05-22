"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock } from "lucide-react"
import { validatePassword, authErrorToMessage, getRedirectUrl } from "@/lib/auth-utils"
import LoginLayout from "@/components/shell/LoginLayout"

const DEFAULT_PRIMARY = "#6D4AFF"

function SetupPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)
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
            if (result.settings.primary_color) setPrimaryColor(result.settings.primary_color)
          }
        }
      } catch {
        // use defaults
      }
    }
    loadBranding()
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login?error=" + encodeURIComponent("Please sign in to set up your password"))
      }
    }
    checkUser()
  }, [router])

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setPasswordError(null)
    setConfirmPasswordError(null)

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.error || "Invalid password")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match")
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError("You must be signed in to set up your password")
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
      data: {
        password_setup_complete: true,
      },
    })

    if (updateError) {
      setError(authErrorToMessage(updateError, "setupPassword"))
      setLoading(false)
    } else {
      const next = await getRedirectUrl(searchParams.get("next"), null)
      const safeNext = next && next !== "/login" ? next : "/"
      window.location.href = safeNext
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

  return (
    <LoginLayout
      brandName={brandName}
      logoUrl={logoUrl}
      brandHeading="Secure your account"
      brandSubtext="Create a password to finish setting up your Marketing Hub workspace."
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Set up your password</h2>
        <p className="mt-1 text-sm text-muted-foreground">Create a password to secure your account</p>

        <form className="mt-6 space-y-4" onSubmit={handleSetupPassword}>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) setPasswordError(null)
                }}
                onBlur={() => {
                  if (password) {
                    const validation = validatePassword(password)
                    if (!validation.valid) {
                      setPasswordError(validation.error || "Invalid password")
                    }
                  }
                }}
                required
                minLength={8}
                className={`pl-10 ${passwordError ? "border-destructive" : ""}`}
              />
            </div>
            {passwordError ? (
              <p className="text-xs text-destructive">{passwordError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                At least 8 characters with mixed character types
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (confirmPasswordError) setConfirmPasswordError(null)
                }}
                required
                minLength={8}
                className={`pl-10 ${confirmPasswordError ? "border-destructive" : ""}`}
              />
            </div>
            {confirmPasswordError && (
              <p className="text-xs text-destructive">{confirmPasswordError}</p>
            )}
          </div>
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <Button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full text-white hover:opacity-90"
            style={buttonStyle}
          >
            {loading ? "Setting up…" : "Set password"}
          </Button>
        </form>
      </div>
    </LoginLayout>
  )
}

export default function SetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <LoginLayout brandName="Marketing Hub">
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        </LoginLayout>
      }
    >
      <SetupPasswordForm />
    </Suspense>
  )
}
