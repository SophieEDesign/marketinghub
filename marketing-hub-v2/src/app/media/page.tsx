import Link from "next/link";
import { MediaGallery } from "@/components/media/MediaGallery";
import { hasMediaDownloadAccess } from "@/lib/auth/media-access";

export default async function PublicMediaPage() {
  const canDownload = await hasMediaDownloadAccess();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Marketing Hub
        </Link>
        <div className="flex flex-wrap gap-2">
          {!canDownload ? (
            <Link
              href="/login?intent=media&next=/media"
              className="btn-primary"
            >
              Sign in to download
            </Link>
          ) : null}
          <Link href="/login" className="btn-secondary">
            Staff login
          </Link>
        </div>
      </div>
      <MediaGallery
        title="Media gallery"
        description="Browse logos and brand photos in collections — view freely, sign in to download."
        showStaffChrome={false}
        initialCanDownload={canDownload}
      />
    </div>
  );
}
