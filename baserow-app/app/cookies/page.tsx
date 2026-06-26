import Link from "next/link"

export const metadata = {
  title: "Cookie Notice — Marketing Hub",
  description: "Cookies and local storage used by Marketing Hub",
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-hub-canvas px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-card p-8 shadow-elevated text-sm text-foreground">
        <h1 className="text-2xl font-semibold tracking-tight">Cookie Notice</h1>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Essential cookies</h2>
          <p>
            Marketing Hub uses Supabase authentication cookies to keep you signed in. These are
            strictly necessary for the service and are not used for advertising or third-party
            analytics.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Local storage</h2>
          <p>
            The app may store UI preferences and unsaved record drafts in your browser&apos;s
            local storage. Drafts can contain business data you are editing; they remain on your
            device until saved or cleared.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">No marketing trackers</h2>
          <p>
            We do not use Google Analytics, advertising pixels, or similar third-party tracking in
            this application.
          </p>
        </section>

        <p className="pt-4 text-muted-foreground">
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy policy
          </Link>
          {" · "}
          <Link href="/login" className="underline hover:text-foreground">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
