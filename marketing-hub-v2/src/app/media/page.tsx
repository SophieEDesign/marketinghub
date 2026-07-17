import Link from "next/link";
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaSignOutButton } from "@/components/media/MediaSignOutButton";
import { BrandLockup } from "@/components/shell/BrandLockup";
import { hasMediaDownloadAccess } from "@/lib/auth/media-access";
import { getSessionUser } from "@/lib/auth/session";

export default async function PublicMediaPage() {
  const canDownload = await hasMediaDownloadAccess();
  const sessionUser = await getSessionUser().catch(() => null);
  const signedIn = Boolean(sessionUser);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="hover:opacity-90">
          <BrandLockup size={36} />
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
          {signedIn ? <MediaSignOutButton /> : null}
          <Link href="/login" className="btn-secondary">
            Staff login
          </Link>
        </div>
      </div>
      <MediaGallery
        title="Media gallery"
        description="Browse logos, presentations, and gallery — view freely, sign in to download."
        showStaffChrome={false}
        initialCanDownload={canDownload}
        scope="public"
      />
    </div>
  );
}
