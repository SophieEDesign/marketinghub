import Link from "next/link"

export const metadata = {
  title: "Privacy Policy — Marketing Hub",
  description: "How Marketing Hub processes personal data",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-hub-canvas px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-card p-8 shadow-elevated text-sm text-foreground">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground">
          Last updated: June 2026. This notice applies to the internal Marketing Hub workspace
          operated by Peters &amp; May.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Who we are</h2>
          <p>
            Marketing Hub is an internal business application for marketing operations. The data
            controller is Peters &amp; May. For privacy enquiries contact your workspace
            administrator.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">What we process</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account data: email, name, role (authentication and access control)</li>
            <li>Workspace content: records, comments, attachments, and activity you create</li>
            <li>Access requests: email and optional name submitted on the signup form</li>
            <li>Technical data: session cookies required to keep you signed in</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Lawful basis</h2>
          <p>
            We process data to perform our contract with authorised users (providing the service),
            for legitimate interests in running marketing operations, and where required for legal
            compliance.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Processors</h2>
          <p>We use the following subprocessors to run the service:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase — database, authentication, and file storage</li>
            <li>Vercel — application hosting</li>
            <li>Resend — transactional email (mentions, automations)</li>
            <li>Upstash — rate limiting (when configured)</li>
            <li>Google Drive — read-only asset gallery (when configured)</li>
            <li>Make.com / Planable — social content sync (when configured)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Retention</h2>
          <p>
            Data is retained while your account is active and as needed for business records.
            Processed access requests and automation logs may be purged on a schedule by
            administrators. Contact an admin to request erasure or export.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Your rights</h2>
          <p>
            Depending on applicable law you may have rights to access, rectify, erase, restrict, or
            export your personal data. Submit requests to a workspace administrator.
          </p>
        </section>

        <p className="pt-4 text-muted-foreground">
          <Link href="/cookies" className="underline hover:text-foreground">
            Cookie notice
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
