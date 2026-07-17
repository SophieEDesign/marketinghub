"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  isMemberPreviewSearch,
  MEMBER_PREVIEW_STORAGE_KEY,
  withMemberPreviewHref,
} from "@/lib/navigation/member-preview"

export type ShellUserRole = "admin" | "member" | null

interface MemberPreviewContextType {
  /** Admin previewing the app as a member (read-only, member nav) */
  isMemberPreview: boolean
  setMemberPreview: (on: boolean) => void
  toggleMemberPreview: () => void
  /** Role used for nav and block permissions */
  effectiveUserRole: ShellUserRole
  userIsAdmin: boolean
}

const MemberPreviewContext = createContext<MemberPreviewContextType | undefined>(
  undefined
)

interface MemberPreviewProviderProps {
  children: ReactNode
  userRole: ShellUserRole
}

export function MemberPreviewProvider({ children, userRole }: MemberPreviewProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const userIsAdmin = userRole === "admin"

  const [isMemberPreview, setIsMemberPreviewState] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const readPreviewFromLocation = useCallback(() => {
    if (typeof window === "undefined") return false
    const fromUrl = isMemberPreviewSearch(window.location.search)
    const fromStorage =
      !userIsAdmin ? false : sessionStorage.getItem(MEMBER_PREVIEW_STORAGE_KEY) === "true"
    return userIsAdmin && (fromUrl || fromStorage)
  }, [userIsAdmin])

  useEffect(() => {
    setIsMemberPreviewState(readPreviewFromLocation())
    setHydrated(true)
  }, [readPreviewFromLocation])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return
    setIsMemberPreviewState(readPreviewFromLocation())
  }, [pathname, hydrated, readPreviewFromLocation])

  const syncUrl = useCallback(
    (on: boolean) => {
      const search =
        typeof window !== "undefined" ? window.location.search : ""
      router.replace(withMemberPreviewHref(`${pathname}${search}`, on))
    },
    [pathname, router]
  )

  const setMemberPreview = useCallback(
    (on: boolean) => {
      if (!userIsAdmin) return
      if (on) {
        sessionStorage.setItem(MEMBER_PREVIEW_STORAGE_KEY, "true")
      } else {
        sessionStorage.removeItem(MEMBER_PREVIEW_STORAGE_KEY)
      }
      setIsMemberPreviewState(on)
      syncUrl(on)
    },
    [userIsAdmin, syncUrl]
  )

  const toggleMemberPreview = useCallback(() => {
    setMemberPreview(!isMemberPreview)
  }, [isMemberPreview, setMemberPreview])

  const effectiveUserRole: ShellUserRole = useMemo(() => {
    if (!userIsAdmin) return userRole
    if (isMemberPreview) return "member"
    return userRole
  }, [userIsAdmin, userRole, isMemberPreview])

  const value = useMemo(
    () => ({
      isMemberPreview: userIsAdmin && isMemberPreview,
      setMemberPreview,
      toggleMemberPreview,
      effectiveUserRole,
      userIsAdmin,
    }),
    [
      userIsAdmin,
      isMemberPreview,
      setMemberPreview,
      toggleMemberPreview,
      effectiveUserRole,
    ]
  )

  return (
    <MemberPreviewContext.Provider value={value}>
      {children}
    </MemberPreviewContext.Provider>
  )
}

export function useMemberPreview(): MemberPreviewContextType {
  const ctx = useContext(MemberPreviewContext)
  if (!ctx) {
    throw new Error("useMemberPreview must be used within MemberPreviewProvider")
  }
  return ctx
}

/** Safe hook for components that may render outside provider (returns inactive preview) */
export function useMemberPreviewOptional(): MemberPreviewContextType | null {
  return useContext(MemberPreviewContext) ?? null
}

export function useEffectiveUserRole(fallback: ShellUserRole = null): ShellUserRole {
  const ctx = useContext(MemberPreviewContext)
  if (!ctx) return fallback
  return ctx.effectiveUserRole
}
