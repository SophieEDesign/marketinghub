"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, User } from "lucide-react"
import { validateEmail, performPostAuthRedirect } from "@/lib/auth-utils"
import ThemeToggle from "@/components/layout/ThemeToggle"
import LoginLayout from "@/components/shell/LoginLayout"

const DEFAULT_PRIMARY = "#1e3a5f"

function SignupForm() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [brandName, setBrandName] = useState<string>("Marketing Hub")
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_PRIMARY)
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
    const checkUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await performPostAuthRedirect(supabase, new URLSearchParams(), {
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
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setEmailError(null)

    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || "Invalid email")
      setLoading(false)
      return
    }

    if (!privacyConsent) {
      setError("Please confirm you have read the privacy policy before submitting.")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/signup-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Could not submit your request")
        setLoading(false)
        return
      }

      setSubmitted(true)
    } catch {
      setError("Could not submit your request. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const buttonStyle = {
    backgroundColor:
      primaryColor.startsWith("#") || primaryColor.startsWith("rgb")
        ? primaryColor
        : DEFAULT_PRIMARY,
    borderColor:
      primaryColor.startsWith("#") || primaryColor.startsWith("rgb")
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
          {submitted ? (
            <>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Request received
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                An administrator will review your request. If approved, you will receive an
                email invitation to set your password and sign in.
              </p>
              <Button asChild className="mt-6 w-full" variant="outline">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Request access
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Submit your details. An admin will review and send an invite if approved.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Work email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="you@petersandmay.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (emailError) setEmailError(null)
                      }}
                      required
                      className={`pl-10 ${emailError ? "border-destructive" : ""}`}
                    />
                  </div>
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border"
                    required
                  />
                  <span>
                    I agree that my details will be processed to review this access request, as
                    described in the{" "}
                    <Link href="/privacy" className="underline hover:text-foreground" target="_blank">
                      privacy policy
                    </Link>
                    .
                  </span>
                </label>

                <Button
                  type="submit"
                  disabled={loading || !privacyConsent}
                  className="w-full text-white hover:opacity-90"
                  style={buttonStyle}
                >
                  {loading ? "Submitting…" : "Request access"}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-hub-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </LoginLayout>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <LoginLayout brandName="Marketing Hub" brandHeading="Welcome to your Marketing Hub">
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        </LoginLayout>
      }
    >
      <SignupForm />
    </Suspense>
  )
}
