"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        console.warn('Could not load branding:', err)
      }
    }
    
    loadBranding()
  }, [])
  
  // Check for error message from URL (e.g., from email confirmation failure)
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  // Redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push("/")
      }
    }
    checkUser()
  }, [router])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/")
      router.refresh()
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/")
      router.refresh()
    }
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
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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
