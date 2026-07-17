"use client"

import { useCallback, useEffect, useState } from "react"
import type { DriveGalleryResponse } from "@/lib/drive/types"

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DriveGalleryResponse }

/** Fetches the gallery for a given folder id (null = root). */
export function useDriveGallery(folderId: string | null, rootFolderId?: string) {
  const [state, setState] = useState<State>({ status: "loading" })

  const load = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const params = new URLSearchParams()
      const id = folderId ?? rootFolderId
      if (id) params.set("folderId", id)
      const res = await fetch(`/api/drive/gallery?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to load gallery")
      setState({ status: "ready", data: json as DriveGalleryResponse })
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Failed to load gallery" })
    }
  }, [folderId, rootFolderId])

  useEffect(() => {
    void load()
  }, [load])

  return { state, reload: load }
}
