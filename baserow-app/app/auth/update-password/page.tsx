"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { validatePassword, authErrorToMessage, getRedirectUrl } from "@/lib/auth-utils"

function UpdatePasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [brandName, setBrandName] = useState<string>("Marketing Hub")
  const [primaryColor, setPrimaryColor] = useState<string>("hsl(222.2, 47.4%, 11.2%)")
  const [ready, setReady] = useState(false)
  const router = useRouter()

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
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Could not load branding:", err)
        }
      }
    }
    loadBranding()
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login?error=" + encodeURIComponent("Please use the link from your password reset email."))
        return
      }
      setReady(true)
    }
    checkSession()
  }, [router])

  const handleUpdatePassword = async (e: React.FormEvent) => {
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

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(authErrorToMessage(updateError, "updatePassword"))
      setLoading(false)
    } else {
      const next = await getRedirectUrl(null, null)
      const safeNext = next && next !== "/login" ? next : "/"
      window.location.href = safeNext
    }
  }

  if (!ready) {
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
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleUpdatePassword}>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                New password
              </label>
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
                required
                minLength={8}
                className={passwordError ? "border-destructive" : ""}
              />
              {passwordError ? (
                <p className="text-xs text-destructive">{passwordError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, numbers, or special characters
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm password
              </label>
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
                className={confirmPasswordError ? "border-destructive" : ""}
              />
              {confirmPasswordError && (
                <p className="text-xs text-destructive">{confirmPasswordError}</p>
              )}
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <Button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full text-white"
              style={{
                backgroundColor: primaryColor,
                borderColor: primaryColor,
                color: "white",
              }}
              onMouseEnter={(e) => {
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
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">Loading...</div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  )
}
