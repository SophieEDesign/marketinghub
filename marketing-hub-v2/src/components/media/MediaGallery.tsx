"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  ImageIcon,
  Link2,
  Lock,
  Presentation,
  Upload,
  X,
} from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/PageHeader";
import {
  MediaDetailPanel,
  type SelectedMediaFile,
} from "@/components/media/MediaDetailPanel";
import {
  GALLERY_CATEGORY,
  MEDIA_HUB_CATEGORIES,
  normalizeGalleryVisibility,
  type GalleryFolderVisibility,
  type MediaFile,
  type MediaListItem,
} from "@/lib/supabase/media-list";
import { uploadAssetDirect } from "@/lib/upload/client-upload";
import { cn } from "@/lib/utils";

type ListResponse = {
  configured: boolean;
  canDownload?: boolean;
  items?: MediaListItem[];
  categories?: string[];
  error?: string;
};

type GalleryPhoto = {
  id: string;
  itemId: string;
  url: string;
  name: string;
  itemName: string;
  publicTitle: string;
  notes: string;
  category: string;
};

const UNSORTED_SUBFOLDER = "Unsorted";
const NEW_FOLDER_VALUE = "__new_folder__";
const NEW_SUBFOLDER_VALUE = "__new_subfolder__";
const MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.pdf,.mp4,.mov";
/** Keep in sync with /api/content/upload MAX_BYTES */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function isAcceptedMediaFile(file: File) {
  if (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type === "video/mp4" ||
    file.type === "video/quicktime"
  ) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|svg|pdf|mp4|mov)$/i.test(file.name);
}

function filesFromList(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter(isAcceptedMediaFile);
}

function nameFromFile(file: File) {
  return file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function formatMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

async function readErrorMessage(res: Response, fallback: string) {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { error?: string };
    if (json.error) return json.error;
  } catch {
    // Non-JSON (e.g. proxy "Request Entity Too Large")
  }
  if (/request entity too large/i.test(text) || res.status === 413) {
    return `File too large for the server (max about ${formatMb(MAX_UPLOAD_BYTES)} each). Try fewer or smaller images.`;
  }
  return text.trim().slice(0, 180) || fallback;
}

function itemDisplayName(item: MediaListItem) {
  return item.display_name || item.public_title || item.name;
}

function itemPublicLabel(item: MediaListItem) {
  return item.public_title?.trim() || item.name || itemDisplayName(item);
}

function photoPublicLabel(photo: GalleryPhoto) {
  return photo.publicTitle.trim() || photo.itemName;
}

function isImageFile(file: MediaFile) {
  return (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)
  );
}

function isDirectImageUrl(url: string) {
  const path = url.split("?")[0] ?? "";
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
}

function extractGoogleDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("google.com")) return null;
    const pathMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (pathMatch?.[1]) return pathMatch[1];
    const idParam = parsed.searchParams.get("id");
    if (idParam) return idParam;
    return null;
  } catch {
    return null;
  }
}

function googleDriveThumbnailUrl(fileId: string) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

function driveThumbFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const fileId = extractGoogleDriveFileId(url);
  return fileId ? googleDriveThumbnailUrl(fileId) : null;
}

/** Prefer real images, then Drive thumbs from links, then image-like cover URLs. */
function previewUrlsFromItems(items: MediaListItem[], limit = 4): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined) => {
    if (!url || seen.has(url) || urls.length >= limit) return;
    seen.add(url);
    urls.push(url);
  };

  for (const item of items) {
    for (const file of item.files) {
      if (isImageFile(file)) add(file.url);
    }
  }

  for (const item of items) {
    for (const candidate of [
      item.document_link,
      item.document_url,
      item.cover_url,
      ...item.files.map((f) => f.url),
    ]) {
      add(driveThumbFromUrl(candidate));
    }
  }

  for (const item of items) {
    if (item.cover_url && isDirectImageUrl(item.cover_url)) {
      add(item.cover_url);
    }
  }

  return urls;
}

type FolderKind = "images" | "documents" | "presentations" | "links" | "mixed" | "empty";

function detectFolderKind(items: MediaListItem[]): FolderKind {
  if (items.length === 0) return "empty";
  let images = 0;
  let docs = 0;
  let decks = 0;
  let links = 0;
  for (const item of items) {
    const hasImage = item.files.some(isImageFile);
    const fileNames = [
      ...item.files.map((f) => f.name),
      item.document_link,
      item.document_url,
      item.name,
    ]
      .filter(Boolean)
      .join(" ");
    if (hasImage) images += 1;
    else if (/\.(pptx?|key)$/i.test(fileNames) || /presentation/i.test(item.category))
      decks += 1;
    else if (/\.(pdf|docx?|xlsx?)$/i.test(fileNames)) docs += 1;
    else if (item.document_link || item.document_url) links += 1;
    else docs += 1;
  }
  if (images > 0 && docs + decks + links === 0) return "images";
  if (decks > 0 && images === 0 && docs === 0) return "presentations";
  if (links > 0 && images === 0 && docs === 0 && decks === 0) return "links";
  if (docs > 0 && images === 0 && decks === 0) return "documents";
  if (images > 0) return "mixed";
  return "documents";
}

function folderKindMeta(kind: FolderKind) {
  switch (kind) {
    case "images":
      return {
        label: "Images",
        Icon: ImageIcon,
        tone: "from-[#0b3a4a] to-[#2a8f9e]",
        chip: "bg-[#2a8f9e]",
      };
    case "presentations":
      return {
        label: "Deck",
        Icon: Presentation,
        tone: "from-[#134e63] to-[#b5651d]",
        chip: "bg-[#b5651d]",
      };
    case "links":
      return {
        label: "Links",
        Icon: Link2,
        tone: "from-[#0b3a4a] to-[#3d4d63]",
        chip: "bg-[#3d4d63]",
      };
    case "empty":
      return {
        label: "Empty",
        Icon: FolderOpen,
        tone: "from-[#9aa8b2] to-[#d7dee4]",
        chip: "bg-[#5b6b76]",
      };
    case "mixed":
      return {
        label: "Mixed",
        Icon: FolderOpen,
        tone: "from-[#0b3a4a] to-[#134e63]",
        chip: "bg-[#0b3a4a]",
      };
    default:
      return {
        label: "Docs",
        Icon: FileText,
        tone: "from-[#1f2a44] to-[#3d4d63]",
        chip: "bg-[#c0292f]",
      };
  }
}

function FolderCoverFallback({
  folderName,
  kind,
  sampleTitle,
}: {
  folderName: string;
  kind: FolderKind;
  sampleTitle?: string;
}) {
  const meta = folderKindMeta(kind);
  const Icon = meta.Icon;
  const isEmpty = kind === "empty";

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br",
        meta.tone
      )}
    >
      {!isEmpty ? (
        <>
          <div
            className="absolute left-[12%] top-[18%] h-[58%] w-[42%] rotate-[-8deg] rounded-xl bg-white/25 shadow-sm"
            aria-hidden
          />
          <div
            className="absolute right-[10%] top-[14%] flex h-[66%] w-[48%] rotate-[5deg] flex-col overflow-hidden rounded-xl border border-white/30 bg-white/95 shadow-md"
            aria-hidden
          >
            <div
              className={cn(
                "flex items-center justify-center px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white",
                meta.chip
              )}
            >
              {meta.label}
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 text-[#0f1c24]">
              <Icon className="h-8 w-8 opacity-70" />
              <p className="line-clamp-2 text-center text-[11px] font-medium leading-snug">
                {sampleTitle || folderName}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-white/80">
          <FolderOpen className="h-12 w-12 opacity-70" />
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            No assets yet
          </p>
        </div>
      )}
    </div>
  );
}

function FolderCoverMedia({
  previews,
  folderName,
  kind,
  sampleTitle,
}: {
  previews: string[];
  folderName: string;
  kind: FolderKind;
  sampleTitle?: string;
}) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const visible = previews.filter((url) => !failed.has(url));

  const onError = (url: string) => {
    setFailed((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  if (visible.length === 0) {
    return (
      <FolderCoverFallback
        folderName={folderName}
        kind={kind}
        sampleTitle={sampleTitle}
      />
    );
  }

  if (visible.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={visible[0]}
        alt=""
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        onError={() => onError(visible[0]!)}
      />
    );
  }

  if (visible.length === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-0.5 bg-black/10">
        {visible.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            onError={() => onError(url)}
          />
        ))}
      </div>
    );
  }

  if (visible.length === 3) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 bg-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={visible[0]}
          alt=""
          className="row-span-2 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          onError={() => onError(visible[0]!)}
        />
        {visible.slice(1).map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            onError={() => onError(url)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 bg-black/10">
      {visible.slice(0, 4).map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          onError={() => onError(url)}
        />
      ))}
    </div>
  );
}

function isGalleryCategory(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase() === GALLERY_CATEGORY.toLowerCase();
}

function itemSubfolder(item: MediaListItem) {
  return item.subfolder?.trim() || UNSORTED_SUBFOLDER;
}

function itemFolderVisibility(item: MediaListItem): GalleryFolderVisibility {
  return normalizeGalleryVisibility(item.subfolder_visibility);
}

function photosFromItems(items: MediaListItem[]): GalleryPhoto[] {
  const photos: GalleryPhoto[] = [];
  for (const item of items) {
    for (const file of item.files) {
      if (!isImageFile(file)) continue;
      photos.push({
        id: `${item.id}__${file.url}`,
        itemId: item.id,
        url: file.url,
        name: file.name,
        itemName: item.name || itemDisplayName(item),
        publicTitle: item.public_title || "",
        notes: item.notes || "",
        category: item.category,
      });
    }
  }
  return photos;
}

const EMPTY_FORM = {
  name: "",
  public_title: "",
  category: GALLERY_CATEGORY,
  subfolder: "",
  subfolder_visibility: "internal" as GalleryFolderVisibility,
  document_link: "",
  notes: "",
};

export function MediaGallery({
  title = "Media",
  description = "Browse brand assets in a gallery-style collection view.",
  showStaffChrome = true,
  initialCanDownload = false,
  hideHeader = false,
  /** Public gallery: Logos, Presentations, Gallery. Staff library: all categories. */
  scope = "public",
  /** Admin view: show Add media / delete. Member & public: browse only. */
  allowManage = false,
}: {
  title?: string;
  description?: string;
  showStaffChrome?: boolean;
  initialCanDownload?: boolean;
  hideHeader?: boolean;
  scope?: "public" | "all";
  allowManage?: boolean;
}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [canDownload, setCanDownload] = useState(initialCanDownload);
  const [collection, setCollection] = useState<string | null>(null);
  const [activeSubfolder, setActiveSubfolder] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [folderMode, setFolderMode] = useState<"existing" | "new">("existing");
  const [newFolderName, setNewFolderName] = useState("");
  const [subfolderMode, setSubfolderMode] = useState<"existing" | "new">(
    "existing"
  );
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/media/list?scope=${scope}`);
    const json = (await res.json()) as ListResponse;
    setData(json);
    if (typeof json.canDownload === "boolean") {
      setCanDownload(json.canDownload);
    }
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);
  const isInternal = scope === "all";

  const collections = useMemo(() => {
    return categories.map((name) => {
      const inCat = items.filter((i) => i.category === name);
      const photos = photosFromItems(inCat);
      const docs = inCat.filter(
        (i) =>
          i.document_link ||
          i.document_url ||
          i.files.some((f) => !isImageFile(f))
      );
      return {
        name,
        photos,
        docs,
        previews: previewUrlsFromItems(inCat),
        kind: detectFolderKind(inCat),
        sampleTitle: inCat[0]
          ? scope === "all"
            ? itemDisplayName(inCat[0])
            : itemPublicLabel(inCat[0])
          : undefined,
        photoCount: photos.length,
        assetCount: inCat.length,
      };
    });
  }, [categories, items, scope]);

  const galleryItems = useMemo(
    () => items.filter((i) => isGalleryCategory(i.category)),
    [items]
  );

  const gallerySubfolders = useMemo(() => {
    const names = Array.from(
      new Set(galleryItems.map((i) => itemSubfolder(i)))
    ).sort((a, b) => {
      if (a === UNSORTED_SUBFOLDER) return 1;
      if (b === UNSORTED_SUBFOLDER) return -1;
      return a.localeCompare(b);
    });
    return names.map((name) => {
      const inFolder = galleryItems.filter((i) => itemSubfolder(i) === name);
      const photos = photosFromItems(inFolder);
      const visibility: GalleryFolderVisibility = inFolder.every(
        (i) => itemFolderVisibility(i) === "public"
      )
        ? "public"
        : "internal";
      return {
        name,
        photos,
        previews: previewUrlsFromItems(inFolder),
        kind: detectFolderKind(inFolder),
        sampleTitle: inFolder[0]
          ? scope === "all"
            ? itemDisplayName(inFolder[0])
            : itemPublicLabel(inFolder[0])
          : undefined,
        photoCount: photos.length,
        assetCount: inFolder.length,
        visibility,
      };
    });
  }, [galleryItems, scope]);

  const knownSubfolders = useMemo(() => {
    return Array.from(
      new Set(
        galleryItems
          .map((i) => i.subfolder?.trim())
          .filter((s): s is string => !!s)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [galleryItems]);

  const inGallery = isGalleryCategory(collection);
  const showingGallerySubfolders = inGallery && !activeSubfolder;

  const visibleItems = useMemo(() => {
    if (!collection) return [];
    const inCat = items.filter((i) => i.category === collection);
    if (!inGallery) return inCat;
    if (!activeSubfolder) return inCat;
    return inCat.filter((i) => itemSubfolder(i) === activeSubfolder);
  }, [items, collection, inGallery, activeSubfolder]);

  const photos = useMemo(
    () => photosFromItems(visibleItems),
    [visibleItems]
  );
  const docs = useMemo(
    () =>
      visibleItems.filter(
        (i) =>
          i.document_link ||
          i.document_url ||
          i.files.some((f) => !isImageFile(f))
      ),
    [visibleItems]
  );
  const lightboxPhoto =
    lightboxIndex != null ? photos[lightboxIndex] ?? null : null;

  const selectedPhoto = useMemo(() => {
    if (!selectedPhotoId) return null;
    const fromGrid = photos.find((p) => p.id === selectedPhotoId);
    if (fromGrid) return fromGrid;

    const sep = selectedPhotoId.indexOf("__");
    if (sep < 0) return null;
    const itemId = selectedPhotoId.slice(0, sep);
    const url = selectedPhotoId.slice(sep + 2);
    const item = items.find((i) => i.id === itemId);
    if (!item) return null;
    const file = item.files.find((f) => f.url === url);
    if (!file) return null;
    return {
      id: selectedPhotoId,
      itemId,
      url: file.url,
      name: file.name,
      itemName: item.name || itemDisplayName(item),
      publicTitle: item.public_title || "",
      notes: item.notes || "",
      category: item.category,
    } satisfies GalleryPhoto;
  }, [photos, selectedPhotoId, items]);

  const selectedDetail: SelectedMediaFile | null = selectedPhoto
    ? {
        itemId: selectedPhoto.itemId,
        url: selectedPhoto.url,
        fileName: selectedPhoto.name,
        itemName: selectedPhoto.itemName,
        publicTitle: selectedPhoto.publicTitle,
        notes: selectedPhoto.notes,
      }
    : null;

  const selectedItem =
    selectedPhoto != null
      ? items.find((i) => i.id === selectedPhoto.itemId) ?? null
      : null;

  useEffect(() => {
    if (!selectedPhotoId) return;
    if (selectedPhoto) return;
    // Selection pointed at a deleted file
    setSelectedPhotoId(null);
  }, [selectedPhotoId, selectedPhoto]);

  useEffect(() => {
    if (!selectedPhotoId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedPhotoId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPhotoId]);

  function openPhoto(index: number) {
    const photo = photos[index];
    if (!photo) return;
    if (allowManage) {
      setSelectedPhotoId(photo.id);
      setLightboxIndex(null);
      return;
    }
    setSelectedPhotoId(null);
    setLightboxIndex(index);
  }

  function openItemInPanel(item: MediaListItem) {
    if (!allowManage) return;
    const image = item.files.find(isImageFile) ?? item.files[0];
    if (!image) return;
    setSelectedPhotoId(`${item.id}__${image.url}`);
    setLightboxIndex(null);
  }

  const formIsGallery = isGalleryCategory(
    folderMode === "new" ? newFolderName : form.category
  );

  useEffect(() => {
    if (lightboxIndex == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") {
        setLightboxIndex((i) =>
          i == null ? null : Math.min(photos.length - 1, i + 1)
        );
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((i) => (i == null ? null : Math.max(0, i - 1)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photos.length]);

  const loginHref = `/login?intent=media&next=${encodeURIComponent("/media")}`;

  const folderOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...MEDIA_HUB_CATEGORIES,
        ...categories,
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  function resetForm(preferredFolder?: string | null, preferredSubfolder?: string | null) {
    const subfolder =
      preferredSubfolder && preferredSubfolder !== UNSORTED_SUBFOLDER
        ? preferredSubfolder
        : "";
    const inherited =
      preferredSubfolder != null
        ? gallerySubfolders.find((sf) => sf.name === preferredSubfolder)
            ?.visibility
        : undefined;
    setForm({
      ...EMPTY_FORM,
      category: preferredFolder || EMPTY_FORM.category,
      subfolder,
      subfolder_visibility: inherited ?? "internal",
    });
    setFolderMode("existing");
    setNewFolderName("");
    setSubfolderMode("existing");
    setNewSubfolderName("");
    setFiles([]);
    setFormError(null);
  }

  function openAddForm() {
    resetForm(collection, activeSubfolder);
    setShowForm(true);
  }

  function addFiles(incoming: File[], openForm = false) {
    if (incoming.length === 0) return;
    if (openForm || showForm) {
      if (!showForm) {
        resetForm(collection, activeSubfolder);
        setShowForm(true);
      }
      setFiles((prev) => {
        const key = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
        const seen = new Set(prev.map(key));
        const next = [...prev];
        for (const file of incoming) {
          if (seen.has(key(file))) continue;
          seen.add(key(file));
          next.push(file);
        }
        return next;
      });
      setForm((prev) =>
        prev.name.trim()
          ? prev
          : { ...prev, name: nameFromFile(incoming[0]) }
      );
      setFormError(null);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!allowManage) return;
    setDragActive(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function onDropFiles(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!allowManage) return;
    const dropped = filesFromList(e.dataTransfer.files);
    if (dropped.length === 0) {
      setFormError("Drop images, PDF, or short video files");
      if (!showForm) {
        resetForm(collection, activeSubfolder);
        setShowForm(true);
      }
      return;
    }
    addFiles(dropped, true);
  }

  function openCollection(name: string) {
    setCollection(name);
    setActiveSubfolder(null);
    setLightboxIndex(null);
  }

  async function createMedia() {
    if (!allowManage || saving) return;
    if (!form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    const folderName =
      folderMode === "new" ? newFolderName.trim() : form.category.trim();
    if (!folderName) {
      setFormError(
        folderMode === "new"
          ? "Enter a category name"
          : "Select a category"
      );
      return;
    }
    const gallerySelected =
      folderName.toLowerCase() === GALLERY_CATEGORY.toLowerCase();
    const subfolderName = gallerySelected
      ? subfolderMode === "new"
        ? newSubfolderName.trim()
        : form.subfolder.trim()
      : "";
    if (gallerySelected && subfolderMode === "new" && !subfolderName) {
      setFormError("Enter a subfolder name");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const oversized = files.filter((f) => f.size > MAX_UPLOAD_BYTES);
      if (oversized.length > 0) {
        throw new Error(
          `These files are over ${formatMb(MAX_UPLOAD_BYTES)}: ${oversized
            .map((f) => f.name)
            .slice(0, 3)
            .join(", ")}${oversized.length > 3 ? ` +${oversized.length - 3} more` : ""}. Remove them or compress, then save again.`
        );
      }

      const uploaded: {
        url: string;
        name: string;
        type?: string;
        size?: number | null;
      }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const uploadedFile = await uploadAssetDirect(file);
          uploaded.push({
            url: uploadedFile.url,
            name: uploadedFile.name || file.name,
            type: file.type,
            size: file.size,
          });
        } catch (e) {
          throw new Error(
            e instanceof Error
              ? `${e.message} (${i + 1}/${files.length})`
              : `Upload failed for ${file.name} (${i + 1}/${files.length})`
          );
        }
      }

      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          public_title: form.public_title,
          category: folderName,
          subfolder: subfolderName,
          subfolder_visibility: gallerySelected
            ? form.subfolder_visibility
            : undefined,
          document_link: form.document_link,
          notes: form.notes,
          files: uploaded.length > 0 ? uploaded : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Could not save media")
        );
      }

      if (gallerySelected) {
        await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_subfolder_visibility",
            subfolder: subfolderName,
            visibility: form.subfolder_visibility,
          }),
        });
      }

      setShowForm(false);
      resetForm();
      setCollection(folderName);
      setActiveSubfolder(
        gallerySelected ? subfolderName || UNSORTED_SUBFOLDER : null
      );
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save media");
    } finally {
      setSaving(false);
    }
  }

  async function removeMedia(id: string) {
    if (!allowManage) return;
    if (!window.confirm("Remove this media item?")) return;
    await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await load();
  }

  async function setSubfolderVisibility(
    folderName: string,
    visibility: GalleryFolderVisibility
  ) {
    if (!allowManage || visibilitySaving) return;
    setVisibilitySaving(folderName);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_subfolder_visibility",
          subfolder:
            folderName === UNSORTED_SUBFOLDER ? "" : folderName,
          visibility,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not update visibility");
      await load();
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Could not update visibility"
      );
    } finally {
      setVisibilitySaving(null);
    }
  }

  const manageActions = allowManage ? (
    <button
      type="button"
      className="btn-primary"
      onClick={openAddForm}
    >
      Add media
    </button>
  ) : undefined;

  const header = hideHeader ? null : showStaffChrome ? (
    <PageHeader
      title={title}
      description={description}
      actions={manageActions}
    />
  ) : (
    <div className="mb-8 text-center">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted">
        Peters &amp; May
      </p>
      <h1 className="font-display text-4xl text-brand md:text-5xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-xl text-muted">{description}</p>
      {!canDownload ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
          <Lock className="h-4 w-4" />
          Browse freely ·{" "}
          <Link
            href={loginHref}
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            Sign in to download
          </Link>
        </p>
      ) : (
        <p className="mt-4 text-sm text-[var(--success)]">
          Downloads enabled
        </p>
      )}
    </div>
  );

  return (
    <div
      onDragEnter={allowManage ? onDragOver : undefined}
      onDragOver={allowManage ? onDragOver : undefined}
      onDragLeave={allowManage ? onDragLeave : undefined}
      onDrop={allowManage ? onDropFiles : undefined}
    >
      {header}

      {allowManage && dragActive ? (
        <div className="pointer-events-none mb-5 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand bg-brand/5 px-4 py-10 text-center">
          <div>
            <Upload className="mx-auto h-8 w-8 text-brand" />
            <p className="mt-2 text-sm font-medium text-brand">
              Drop files to add media
            </p>
            <p className="mt-1 text-xs text-muted">
              Images, PDF, or short video
            </p>
          </div>
        </div>
      ) : null}

      {hideHeader ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-brand">Media</h2>
            {!allowManage ? (
              <p className="mt-0.5 text-xs text-muted">
                Browse and download brand assets
              </p>
            ) : null}
          </div>
          {manageActions}
        </div>
      ) : null}

      {allowManage && showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          <div>
            <label className="label">Name (internal)</label>
            <input
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Primary logo pack"
            />
          </div>
          <div>
            <label className="label">Public title</label>
            <input
              className="field"
              value={form.public_title}
              onChange={(e) =>
                setForm({ ...form, public_title: e.target.value })
              }
              placeholder="Shown on public gallery (optional)"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="field"
              value={folderMode === "new" ? NEW_FOLDER_VALUE : form.category}
              onChange={(e) => {
                const value = e.target.value;
                if (value === NEW_FOLDER_VALUE) {
                  setFolderMode("new");
                  return;
                }
                setFolderMode("existing");
                setForm({ ...form, category: value, subfolder: "" });
                setSubfolderMode("existing");
                setNewSubfolderName("");
              }}
              aria-label="Category"
            >
              {folderOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_FOLDER_VALUE}>+ Add new category…</option>
            </select>
            {folderMode === "new" ? (
              <input
                className="field mt-2"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Presentations"
                autoFocus
              />
            ) : (
              <p className="mt-1 text-xs text-muted">
                Presentations, Logos, Gallery, Documents, and more
              </p>
            )}
          </div>
          {formIsGallery ? (
            <div>
              <label className="label">Gallery subfolder</label>
              <select
                className="field"
                value={
                  subfolderMode === "new"
                    ? NEW_SUBFOLDER_VALUE
                    : form.subfolder || ""
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === NEW_SUBFOLDER_VALUE) {
                    setSubfolderMode("new");
                    setForm({
                      ...form,
                      subfolder: "",
                      subfolder_visibility: "internal",
                    });
                    return;
                  }
                  setSubfolderMode("existing");
                  const folderKey = value || UNSORTED_SUBFOLDER;
                  const inherited = gallerySubfolders.find(
                    (sf) => sf.name === folderKey
                  )?.visibility;
                  setForm({
                    ...form,
                    subfolder: value,
                    subfolder_visibility: inherited ?? "internal",
                  });
                }}
              >
                <option value="">Unsorted</option>
                {knownSubfolders.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value={NEW_SUBFOLDER_VALUE}>+ Add new subfolder…</option>
              </select>
              {subfolderMode === "new" ? (
                <input
                  className="field mt-2"
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.target.value)}
                  placeholder="e.g. Yacht loads, Events"
                  autoFocus
                />
              ) : (
                <p className="mt-1 text-xs text-muted">
                  Sort images into a subfolder under Gallery
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="label">Document / link URL</label>
              <input
                className="field"
                value={form.document_link}
                onChange={(e) =>
                  setForm({ ...form, document_link: e.target.value })
                }
                placeholder="https://…"
              />
            </div>
          )}
          {formIsGallery ? (
            <div>
              <label className="label">Folder visibility</label>
              <div
                className="inline-flex w-full rounded-xl border border-border bg-sand/60 p-1"
                role="group"
                aria-label="Folder visibility"
              >
                {(
                  [
                    { id: "public", label: "Public", icon: Globe },
                    { id: "internal", label: "Internal", icon: Lock },
                  ] as const
                ).map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                        form.subfolder_visibility === option.id
                          ? "bg-white text-brand shadow-sm"
                          : "text-muted hover:text-foreground"
                      )}
                      onClick={() =>
                        setForm({
                          ...form,
                          subfolder_visibility: option.id,
                        })
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">
                Public folders appear on the external media gallery. Internal
                stay staff-only.
              </p>
            </div>
          ) : null}
          {formIsGallery ? (
            <div className="md:col-span-2">
              <label className="label">Document / link URL</label>
              <input
                className="field"
                value={form.document_link}
                onChange={(e) =>
                  setForm({ ...form, document_link: e.target.value })
                }
                placeholder="https://…"
              />
            </div>
          ) : null}
          <div className="md:col-span-2">
            <label className="label">Upload images</label>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
                dragActive
                  ? "border-brand bg-brand/5"
                  : "border-border bg-sand/30 hover:border-brand/40 hover:bg-sand/50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={onDragOver}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDropFiles}
            >
              <Upload
                className={cn(
                  "mx-auto h-7 w-7",
                  dragActive ? "text-brand" : "text-muted"
                )}
              />
              <p className="mt-2 text-sm font-medium text-brand">
                Drag &amp; drop files here
              </p>
              <p className="mt-1 text-xs text-muted">
                Drop a folder of images or pick multiple files · uploads go
                straight to storage (max {formatMb(MAX_UPLOAD_BYTES)} each)
              </p>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                multiple
                accept={MEDIA_ACCEPT}
                onChange={(e) => {
                  addFiles(filesFromList(e.target.files));
                  e.target.value = "";
                }}
              />
            </div>
            {files.length > 0 ? (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-white">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">{file.name}</span>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 px-2 py-1 text-xs text-[var(--danger)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles((prev) => prev.filter((_, i) => i !== index));
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea
              className="field min-h-[70px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {formError ? (
            <p className="md:col-span-2 text-sm text-[var(--danger)]">
              {formError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn("btn-primary", saving && "opacity-70")}
              disabled={saving}
              onClick={() => void createMedia()}
            >
              {saving
                ? files.length > 1
                  ? `Uploading ${files.length} files…`
                  : "Saving…"
                : "Save"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={saving}
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading gallery…</p>
      ) : !data?.configured ? (
        <EmptyState
          title="Media list not connected"
          description={
            data?.error || "Connect Supabase to load Media Links Resources."
          }
        />
      ) : data.error && items.length === 0 ? (
        <EmptyState title="Couldn’t load media" description={data.error} />
      ) : !collection ? (
        <div>
          <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Categories
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((col) => (
              <button
                key={col.name}
                type="button"
                onClick={() => openCollection(col.name)}
                className="group overflow-hidden rounded-2xl border border-border bg-white text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f0f2f3]">
                  <FolderCoverMedia
                    previews={col.previews}
                    folderName={col.name}
                    kind={col.kind}
                    sampleTitle={col.sampleTitle}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-lg font-medium tracking-tight">
                      {col.name}
                    </p>
                    <p className="mt-0.5 text-xs text-white/80">
                      {col.photoCount > 0
                        ? `${col.photoCount} photo${col.photoCount === 1 ? "" : "s"}`
                        : `${col.assetCount} asset${col.assetCount === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {collections.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description={
                allowManage
                  ? "Add media and pick a category (e.g. Presentations, Logos)."
                  : "Add rows to Media Links Resources in Supabase."
              }
            />
          ) : null}
        </div>
      ) : showingGallerySubfolders ? (
        <div>
          <div className="mb-6">
            <button
              type="button"
              className="mb-2 text-sm text-muted transition hover:text-brand"
              onClick={() => {
                setCollection(null);
                setActiveSubfolder(null);
                setLightboxIndex(null);
              }}
            >
              ← All categories
            </button>
            <h2 className="font-display text-3xl text-brand md:text-4xl">
              Gallery
            </h2>
            <p className="mt-1 text-sm text-muted">
              Choose a subfolder to browse images
              {allowManage
                ? " — set each folder Public (external) or Internal (staff)"
                : ""}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {gallerySubfolders.map((sf) => (
              <div
                key={sf.name}
                className="group overflow-hidden rounded-2xl border border-border bg-white text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubfolder(sf.name);
                    setLightboxIndex(null);
                  }}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#f0f2f3]">
                    <FolderCoverMedia
                      previews={sf.previews}
                      folderName={sf.name}
                      kind={sf.kind}
                      sampleTitle={sf.sampleTitle}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <p className="text-lg font-medium tracking-tight">
                        {sf.name}
                      </p>
                      <p className="mt-0.5 text-xs text-white/80">
                        {sf.photoCount > 0
                          ? `${sf.photoCount} photo${sf.photoCount === 1 ? "" : "s"}`
                          : `${sf.assetCount} asset${sf.assetCount === 1 ? "" : "s"}`}
                        {" · "}
                        {sf.visibility === "public" ? "Public" : "Internal"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        sf.visibility === "public"
                          ? "bg-white/90 text-brand"
                          : "bg-black/50 text-white"
                      )}
                    >
                      {sf.visibility === "public" ? (
                        <Globe className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {sf.visibility}
                    </span>
                  </div>
                </button>
                {allowManage ? (
                  <div className="flex border-t border-border p-1">
                    {(
                      [
                        { id: "public", label: "Public" },
                        { id: "internal", label: "Internal" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={visibilitySaving === sf.name}
                        className={cn(
                          "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                          sf.visibility === option.id
                            ? "bg-accent-soft text-brand"
                            : "text-muted hover:text-foreground"
                        )}
                        onClick={() =>
                          setSubfolderVisibility(sf.name, option.id)
                        }
                      >
                        {visibilitySaving === sf.name &&
                        sf.visibility !== option.id
                          ? "…"
                          : option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {gallerySubfolders.length === 0 ? (
            <EmptyState
              title="No Gallery subfolders yet"
              description={
                allowManage
                  ? "Add media with Category = Gallery and create a subfolder to sort images."
                  : "Gallery images will appear here once sorted into subfolders."
              }
            />
          ) : null}
        </div>
      ) : (
        <div>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <button
                type="button"
                className="mb-2 text-sm text-muted transition hover:text-brand"
                onClick={() => {
                  if (inGallery && activeSubfolder) {
                    setActiveSubfolder(null);
                    setLightboxIndex(null);
                    return;
                  }
                  setCollection(null);
                  setActiveSubfolder(null);
                  setLightboxIndex(null);
                }}
              >
                {inGallery && activeSubfolder
                  ? "← Gallery subfolders"
                  : "← All categories"}
              </button>
              <h2 className="font-display text-3xl text-brand md:text-4xl">
                {inGallery && activeSubfolder
                  ? activeSubfolder
                  : collection}
              </h2>
              {inGallery && activeSubfolder ? (
                <p className="mt-0.5 text-xs text-muted">Gallery / {activeSubfolder}</p>
              ) : null}
              <p className="mt-1 text-sm text-muted">
                {photos.length > 0
                  ? `${photos.length} photo${photos.length === 1 ? "" : "s"}`
                  : "Documents & links"}
                {canDownload ? " · Click a photo to preview & download" : ""}
              </p>
              {allowManage && inGallery && activeSubfolder ? (
                <div
                  className="mt-3 inline-flex rounded-xl border border-border bg-sand/60 p-1"
                  role="group"
                  aria-label="Folder visibility"
                >
                  {(
                    [
                      { id: "public", label: "Public" },
                      { id: "internal", label: "Internal" },
                    ] as const
                  ).map((option) => {
                    const current =
                      gallerySubfolders.find((sf) => sf.name === activeSubfolder)
                        ?.visibility ?? "internal";
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={visibilitySaving === activeSubfolder}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                          current === option.id
                            ? "bg-white text-brand shadow-sm"
                            : "text-muted hover:text-foreground"
                        )}
                        onClick={() =>
                          setSubfolderVisibility(activeSubfolder, option.id)
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {canDownload && photos.length > 0 ? (
              <p className="text-xs text-[var(--success)]">
                Downloads enabled for your account
              </p>
            ) : null}
          </div>

          {photos.length > 0 ? (
            <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 lg:gap-3">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="group relative mb-2 break-inside-avoid overflow-hidden rounded-lg bg-[#f0f2f3] lg:mb-3"
                >
                  <button
                    type="button"
                    className={cn(
                      "block w-full text-left",
                      allowManage &&
                        selectedPhotoId === photo.id &&
                        "ring-2 ring-brand ring-offset-2"
                    )}
                    onClick={() => openPhoto(index)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="w-full object-cover transition duration-300 group-hover:brightness-95"
                      loading="lazy"
                    />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <span className="min-w-0 truncate text-left text-[11px] text-white">
                      {isInternal ? (
                        <>
                          <span className="block truncate font-medium">
                            {photo.name}
                          </span>
                          {photo.itemName && photo.itemName !== photo.name ? (
                            <span className="block truncate text-[10px] text-white/75">
                              {photo.itemName}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        photoPublicLabel(photo)
                      )}
                    </span>
                    {canDownload ? (
                      <a
                        href={photo.url}
                        download={photo.name}
                        target="_blank"
                        rel="noreferrer"
                        className="pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-brand shadow-sm hover:bg-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {docs.length > 0 ? (
            <div className={cn(photos.length > 0 && "mt-10")}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Files &amp; links
              </h3>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
                {docs.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {isInternal
                          ? item.name || itemDisplayName(item)
                          : itemPublicLabel(item)}
                      </p>
                      <p className="text-xs text-muted">
                        {isInternal
                          ? [
                              item.public_title &&
                              item.public_title !== item.name
                                ? `Public: ${item.public_title}`
                                : null,
                              item.files
                                .filter((f) => !isImageFile(f))
                                .map((f) => f.name)
                                .slice(0, 2)
                                .join(", ") || null,
                              item.status || item.owned_by || null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Asset"
                          : item.status || "Asset"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.files
                        .filter((f) => !isImageFile(f))
                        .map((fileItem) =>
                          canDownload ? (
                            <a
                              key={fileItem.url}
                              href={fileItem.url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary px-2.5 py-1.5 text-xs"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {fileItem.name.slice(0, 18)}
                            </a>
                          ) : (
                            <Link
                              key={fileItem.url}
                              href={loginHref}
                              className="btn-ghost px-2.5 py-1.5 text-xs"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              Sign in
                            </Link>
                          )
                        )}
                      {(item.document_link || item.document_url) &&
                        (canDownload ? (
                          <a
                            href={item.document_link || item.document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary px-2.5 py-1.5 text-xs"
                          >
                            Open
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <Link
                            href={loginHref}
                            className="btn-ghost px-2.5 py-1.5 text-xs"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Sign in
                          </Link>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {photos.length === 0 && docs.length === 0 ? (
            <EmptyState
              title="Empty folder"
              description="No photos or files in this folder yet."
            />
          ) : null}

          {allowManage && visibleItems.length > 0 ? (
            <div className="mt-10">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Manage assets
              </h3>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
                {visibleItems.map((item) => (
                    <li
                      key={`manage-${item.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openItemInPanel(item)}
                      >
                        <p className="truncate text-sm font-medium">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted">
                          {[
                            item.files.map((f) => f.name).slice(0, 3).join(", ") ||
                              null,
                            item.files.length > 3
                              ? `+${item.files.length - 3} more`
                              : null,
                            item.subfolder
                              ? `Subfolder: ${item.subfolder}`
                              : null,
                            item.public_title && item.public_title !== item.name
                              ? `Public: ${item.public_title}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Asset"}
                        </p>
                      </button>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-2.5 py-1.5 text-xs"
                          onClick={() => openItemInPanel(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1.5 text-xs text-[var(--danger)]"
                          onClick={() => void removeMedia(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {allowManage && selectedDetail ? (
        <MediaDetailPanel
          selected={selectedDetail}
          item={selectedItem}
          onClose={() => setSelectedPhotoId(null)}
          onSaved={async () => {
            await load();
          }}
        />
      ) : null}

      {lightboxPhoto && lightboxIndex != null ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/92 md:left-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxPhoto.name}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white/90">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {isInternal
                  ? lightboxPhoto.itemName
                  : photoPublicLabel(lightboxPhoto)}
              </p>
              <p className="truncate text-xs text-white/60">
                {isInternal
                  ? `${lightboxPhoto.name} · ${lightboxIndex + 1} / ${photos.length}`
                  : `${lightboxIndex + 1} / ${photos.length}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canDownload ? (
                <a
                  href={lightboxPhoto.url}
                  download={lightboxPhoto.name}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              ) : (
                <Link
                  href={loginHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                >
                  <Lock className="h-4 w-4" />
                  Sign in
                </Link>
              )}
              <button
                type="button"
                className="rounded-xl bg-white/10 p-2 hover:bg-white/15"
                onClick={() => setLightboxIndex(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
            {lightboxIndex > 0 ? (
              <button
                type="button"
                className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:left-6"
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.name}
              className="max-h-full max-w-full object-contain"
            />
            {lightboxIndex < photos.length - 1 ? (
              <button
                type="button"
                className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:right-6"
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
