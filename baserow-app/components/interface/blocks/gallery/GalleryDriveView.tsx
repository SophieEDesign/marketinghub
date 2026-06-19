"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  ChevronLeft,
  Search,
  ExternalLink,
  HardDrive,
  ImageIcon,
  Download,
  X,
  Sailboat,
  Ship,
  Truck,
  Container,
  Anchor,
  type LucideIcon,
} from "lucide-react"
import { useDriveGallery } from "./useDriveGallery"
import type { DriveGalleryImage } from "@/lib/drive/types"
import { cn } from "@/lib/utils"

type Props = {
  rootFolderId: string
  title?: string
  subtitle?: string
  className?: string
  isEditing?: boolean
}

/** Pick a vessel icon for folders with no cover image, by name keyword. */
function folderIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (n.includes("superyacht") || n.includes("catamaran") || n.includes("sail") || n.includes("racing"))
    return Sailboat
  if (n.includes("forward")) return Truck
  if (n.includes("rail") || n.includes("flat") || n.includes("container")) return Container
  if (n.includes("commercial") || n.includes("liner") || n.includes("cargo")) return Ship
  return Anchor
}

export default function GalleryDriveView({
  rootFolderId,
  title,
  subtitle,
  className,
  isEditing = false,
}: Props) {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [lightbox, setLightbox] = useState<DriveGalleryImage | null>(null)
  const { state } = useDriveGallery(folderId, rootFolderId)

  useEffect(() => setQuery(""), [folderId])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(null)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightbox])

  const inFolder = folderId !== null
  const q = query.trim().toLowerCase()

  const header = useMemo(() => {
    if (state.status === "ready" && state.data.kind === "images") {
      return {
        title: state.data.folder.name,
        subtitle: `${state.data.images.length} images in this collection`,
        webViewLink: state.data.folder.webViewLink,
      }
    }
    return {
      title: title ?? "Shared Image Gallery",
      subtitle: subtitle ?? "Approved marine photography by vessel type and sector.",
      webViewLink: null as string | null,
    }
  }, [state, title, subtitle])

  const openFolder = (id: string) => {
    if (isEditing) return
    setFolderId(id)
  }

  const openLightbox = (image: DriveGalleryImage) => {
    if (isEditing) return
    setLightbox(image)
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[18px] border border-[#e4e7ec] bg-white shadow-[0_1px_3px_rgba(31,42,68,0.05),0_14px_40px_rgba(31,42,68,0.05)]",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eef1f4] px-6 py-5">
        <div className="flex min-w-0 items-start gap-3.5">
          {inFolder && (
            <button
              type="button"
              onClick={() => !isEditing && setFolderId(null)}
              aria-label="Back to collections"
              disabled={isEditing}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-[#d4d7dc] bg-white hover:bg-[#f7f9fb] disabled:cursor-default disabled:opacity-60"
            >
              <ChevronLeft className="h-[18px] w-[18px] text-[#5c6168]" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#1f2a44]">{header.title}</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ecdfc8] bg-[#f7f1e6] px-2.5 py-1 text-[10.5px] font-semibold text-[#b08d52]">
                <HardDrive className="h-3 w-3" /> Google Drive
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] text-[#9aa1ab]">{header.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-[38px] w-[210px] items-center gap-2 rounded-[9px] border border-[#e2e6ea] bg-[#f5f7fa] px-3">
            <Search className="h-[15px] w-[15px] text-[#9aa1ab]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={inFolder ? "Search images…" : "Search collections…"}
              className="h-full flex-1 bg-transparent text-[13px] text-[#1f2a44] outline-none placeholder:text-[#9aa1ab]"
            />
          </div>
          {!isEditing && (
            <a
              href={header.webViewLink ?? "https://drive.google.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[38px] items-center gap-1.5 rounded-[9px] border border-[#d4d7dc] bg-white px-3.5 text-[12.5px] font-semibold text-[#1f2a44] hover:bg-[#f7f9fb]"
            >
              <ExternalLink className="h-[15px] w-[15px]" /> Open in Drive
            </a>
          )}
        </div>
      </div>

      <div className="px-6 py-[22px]">
        {state.status === "loading" && <SkeletonGrid inFolder={inFolder} />}

        {state.status === "error" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#d4d7dc] py-14 text-center">
            <p className="text-sm font-semibold text-[#1f2a44]">Couldn’t load the gallery</p>
            <p className="max-w-sm text-[13px] text-[#9aa1ab]">{state.message}</p>
            <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#005b8f] hover:underline">
              Open the Google Drive gallery →
            </a>
          </div>
        )}

        {state.status === "ready" && state.data.kind === "folders" && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[18px]">
            {state.data.folders
              .filter((f) => !q || f.name.toLowerCase().includes(q))
              .map((f) => {
                const Icon = folderIcon(f.name)
                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => openFolder(f.id)}
                    disabled={isEditing}
                    className="group block overflow-hidden rounded-[15px] border border-[#e4e7ec] bg-white text-left shadow-[0_1px_2px_rgba(31,42,68,0.04)] transition-all hover:-translate-y-[3px] hover:border-[#d7dce3] hover:shadow-[0_16px_34px_rgba(31,42,68,0.16)] disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-[0_1px_2px_rgba(31,42,68,0.04)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#1b2c40]">
                      {f.coverThumb ? (
                        <>
                          <Image src={f.coverThumb} alt={f.name} fill unoptimized className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,28,43,0)_38%,rgba(15,28,43,0.78)_100%)]" />
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#1f2a44,#0f1c2b)]">
                          <Icon className="h-[52px] w-[52px] text-[#c4a574]/55" strokeWidth={1.4} />
                        </div>
                      )}
                      <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-[7px] bg-white/90 px-2 py-1 text-[10px] font-bold text-[#1f2a44] backdrop-blur-sm">
                        <ImageIcon className="h-3 w-3 text-[#5c6168]" /> {f.count}
                      </span>
                      <div className="absolute inset-x-3 bottom-3">
                        <div className="text-[15px] font-semibold tracking-[-0.01em] text-white">{f.name}</div>
                        <div className="mt-1 text-[11px] font-medium text-white/75">{f.count} images</div>
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        )}

        {state.status === "ready" && state.data.kind === "images" && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5">
            {state.data.images
              .filter((im) => !q || im.name.toLowerCase().includes(q))
              .map((im) => (
                <button
                  type="button"
                  key={im.id}
                  onClick={() => openLightbox(im)}
                  disabled={isEditing}
                  className="group relative aspect-square overflow-hidden rounded-[13px] border border-[#e4e7ec] bg-[#eef1f4] hover:shadow-[0_12px_26px_rgba(31,42,68,0.16)] disabled:cursor-default"
                >
                  <Image src={im.thumb} alt={im.name} fill unoptimized className="object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,28,43,0)_55%,rgba(15,28,43,0.6)_100%)] opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="absolute inset-x-2.5 bottom-2 truncate text-left text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {im.name}
                  </span>
                  <span className={cn("absolute right-2 top-2 rounded-[5px] px-1.5 py-1 text-[8.5px] font-extrabold tracking-[0.04em]", im.type === "PNG" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                    {im.type}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="border-t border-[#eef1f4] bg-[#fafbfc] px-6 py-3.5">
        <span className="text-[12.5px] text-[#9aa1ab]">
          Prefer the source?{" "}
          <a href={header.webViewLink ?? "https://drive.google.com"} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#005b8f] hover:underline">
            Open the Google Drive gallery →
          </a>
        </span>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 md:left-sidebar z-[60] flex items-center justify-center bg-[rgba(9,17,27,0.82)] p-10"
        >
          <div className="relative w-full max-w-[940px]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.full} alt={lightbox.name} className="max-h-[74vh] w-full rounded-xl object-contain shadow-[0_30px_80px_rgba(0,0,0,0.5)]" />
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-base font-semibold text-white">{lightbox.name}</div>
                <div className="mt-1.5 text-[12.5px] text-white/60">
                  {[lightbox.type, lightbox.width && lightbox.height ? `${lightbox.width}×${lightbox.height}` : null, "Google Drive"].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="flex shrink-0 gap-2.5">
                <a
                  href={lightbox.download}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-[42px] items-center gap-1.5 rounded-[10px] border border-white/25 bg-white/15 px-4 text-[12.5px] font-semibold text-white hover:bg-white/25"
                >
                  <Download className="h-[15px] w-[15px]" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  aria-label="Close"
                  className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] border border-white/25 bg-white/15 hover:bg-white/25"
                >
                  <X className="h-[18px] w-[18px] text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SkeletonGrid({ inFolder }: { inFolder: boolean }) {
  const n = inFolder ? 10 : 8
  return (
    <div
      className={cn(
        "grid gap-[18px]",
        inFolder ? "grid-cols-[repeat(auto-fill,minmax(190px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
      )}
    >
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={cn("animate-pulse rounded-[14px] bg-[#eef1f4]", inFolder ? "aspect-square" : "aspect-[4/3]")} />
      ))}
    </div>
  )
}
