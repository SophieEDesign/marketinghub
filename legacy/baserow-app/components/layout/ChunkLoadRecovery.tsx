"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import {
  clearChunkReloadFlag,
  isChunkLoadError,
  reloadOnceForStaleChunks,
} from "@/lib/chunk-load-error"

/**
 * Recovers from stale Next.js chunk references after a Vercel deploy.
 * Listens for webpack dynamic import failures and triggers a single reload.
 */
export default function ChunkLoadRecovery() {
  const pathname = usePathname()

  useEffect(() => {
    clearChunkReloadFlag()
  }, [pathname])

  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) return
      event.preventDefault()
      reloadOnceForStaleChunks()
    }

    const onError = (event: ErrorEvent) => {
      if (!isChunkLoadError(event.error ?? event.message)) return
      reloadOnceForStaleChunks()
    }

    window.addEventListener("unhandledrejection", onUnhandledRejection)
    window.addEventListener("error", onError)
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
      window.removeEventListener("error", onError)
    }
  }, [])

  return null
}
