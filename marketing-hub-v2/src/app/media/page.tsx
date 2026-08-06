import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaPageChrome } from "@/components/media/MediaPageChrome";
import { hasMediaDownloadAccess } from "@/lib/auth/media-access";
import { getSessionUser } from "@/lib/auth/session";

export default async function PublicMediaPage() {
  const canDownload = await hasMediaDownloadAccess();
  const sessionUser = await getSessionUser().catch(() => null);
  const signedIn = Boolean(sessionUser);
  const isExternalGuest = sessionUser?.role === "media_guest";

  return (
    <MediaPageChrome
      canDownload={canDownload}
      signedIn={signedIn}
      userKey={sessionUser?.email || sessionUser?.full_name || ""}
      isExternalGuest={Boolean(isExternalGuest)}
    >
      <MediaGallery
        title="Media gallery"
        description="Browse logos, presentations, and gallery — view freely, sign in to download."
        showStaffChrome={false}
        initialCanDownload={canDownload}
        scope="public"
      />
    </MediaPageChrome>
  );
}
