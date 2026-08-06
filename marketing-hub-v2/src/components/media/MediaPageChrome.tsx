"use client";

import Link from "next/link";
import { HubTourProvider } from "@/components/tour/HubTour";
import { BrandLockup } from "@/components/shell/BrandLockup";
import { MediaSignOutButton } from "@/components/media/MediaSignOutButton";

/**
 * Public /media chrome + optional first-login tour for signed-in external guests.
 */
export function MediaPageChrome({
  canDownload,
  signedIn,
  userKey,
  isExternalGuest,
  children,
}: {
  canDownload: boolean;
  signedIn: boolean;
  userKey: string;
  isExternalGuest: boolean;
  children: React.ReactNode;
}) {
  const body = (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <div
        data-tour="media-header"
        className="mb-6 flex flex-wrap items-center justify-between gap-3"
      >
        <Link href="/" className="hover:opacity-90">
          <BrandLockup size={36} />
        </Link>
        <div data-tour="media-auth" className="flex flex-wrap gap-2">
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
      <div data-tour="media-gallery">{children}</div>
    </div>
  );

  if (!isExternalGuest || !userKey) {
    return body;
  }

  return (
    <HubTourProvider userKey={userKey} audience="external" accessRole="media_guest">
      {body}
    </HubTourProvider>
  );
}
