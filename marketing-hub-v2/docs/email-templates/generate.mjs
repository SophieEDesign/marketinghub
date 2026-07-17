/**
 * Regenerates all branded Auth email HTML files from brand-shell.mjs.
 * Run: node docs/email-templates/generate.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brandEmail } from "./brand-shell.mjs";

const dir = dirname(fileURLToPath(import.meta.url));

const templates = [
  {
    file: "invite-user.html",
    subject: "You're invited to Peters & May Marketing Hub",
    dashboard: "Invite user",
    html: brandEmail({
      title: "Marketing Hub invitation",
      heading: "You’ve been invited",
      paragraphs: [
        "You’ve been invited to create an account on the Peters &amp; May Marketing Hub.",
        "Click the button below to accept your invitation and set your password.",
      ],
      ctaLabel: "Accept invitation",
      afterCtaHtml: `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                  If you didn’t expect this invitation, you can ignore this email.
                </p>`,
    }),
  },
  {
    file: "confirm-signup.html",
    subject: "Confirm your Marketing Hub email",
    dashboard: "Confirm signup",
    html: brandEmail({
      title: "Confirm your email",
      heading: "Confirm your email",
      paragraphs: [
        "Thanks for signing up to the Peters &amp; May Marketing Hub.",
        "Confirm your email address to finish setting up your account.",
      ],
      ctaLabel: "Confirm email",
    }),
  },
  {
    file: "magic-link.html",
    subject: "Your Marketing Hub sign-in link",
    dashboard: "Magic Link",
    html: brandEmail({
      title: "Sign in",
      heading: "Sign in to Marketing Hub",
      paragraphs: [
        "Use the button below to sign in. This link expires shortly and can only be used once.",
      ],
      ctaLabel: "Sign in",
      afterCtaHtml: `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                  Or enter this one-time code: <strong style="color:#0b3a4a;letter-spacing:0.08em;">{{ .Token }}</strong>
                </p>`,
    }),
  },
  {
    file: "reset-password.html",
    subject: "Reset your Marketing Hub password",
    dashboard: "Reset Password",
    html: brandEmail({
      title: "Reset password",
      heading: "Reset your password",
      paragraphs: [
        "We received a request to reset your Marketing Hub password.",
        "Click the button below to choose a new one.",
      ],
      ctaLabel: "Reset password",
      afterCtaHtml: `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                  If you didn’t request this, you can safely ignore this email.
                </p>`,
    }),
  },
  {
    file: "change-email.html",
    subject: "Confirm your new Marketing Hub email",
    dashboard: "Change Email Address",
    html: brandEmail({
      title: "Confirm email change",
      heading: "Confirm email change",
      paragraphs: [
        "Follow the link below to confirm changing your Marketing Hub email to <strong>{{ .NewEmail }}</strong>.",
      ],
      ctaLabel: "Confirm new email",
      afterCtaHtml: `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                  If you didn’t request this change, you can ignore this email.
                </p>`,
    }),
  },
  {
    file: "reauthentication.html",
    subject: "Confirm it’s you — Marketing Hub",
    dashboard: "Reauthentication",
    html: brandEmail({
      title: "Confirm it’s you",
      heading: "Confirm it’s you",
      paragraphs: [
        "Enter this code to confirm a sensitive change on your Marketing Hub account.",
      ],
      ctaLabel: "Open Marketing Hub",
      ctaHref: "https://marketing.petersandmay.com/login",
      showFallbackLink: false,
      afterCtaHtml: `<p style="margin:24px 0 0;font-size:28px;line-height:1.2;letter-spacing:0.2em;font-weight:700;color:#0b3a4a;text-align:center;">
                  {{ .Token }}
                </p>
                <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">
                  This code expires shortly.
                </p>`,
    }),
  },
];

const readme = `# Auth email templates (branded header)

All Marketing Hub Auth emails share the same Peters &amp; May header (logo + teal bar) and footer.

## Apply in Supabase (required for production)

Dashboard cannot be updated from the app. For **each** template:

1. Open [Authentication → Email Templates](https://supabase.com/dashboard/project/hwtycgvclhckglmuwnmw/auth/templates)
2. Select the template name below
3. Set the **Subject**
4. Paste the full HTML from the matching file
5. Save

| Dashboard name | File | Subject |
|---|---|---|
${templates
  .map((t) => `| ${t.dashboard} | \`${t.file}\` | ${t.subject} |`)
  .join("\n")}

Regenerate HTML after editing \`brand-shell.mjs\`:

\`\`\`bash
node docs/email-templates/generate.mjs
\`\`\`

## Local CLI (optional)

\`supabase/config.toml\` points at these files for local Auth email previews.
`;

for (const t of templates) {
  const banner = `<!--
  Dashboard: Authentication → Email Templates → ${t.dashboard}
  Subject: ${t.subject}
  Regenerate: node docs/email-templates/generate.mjs
-->
`;
  writeFileSync(join(dir, t.file), banner + t.html, "utf8");
  console.log("wrote", t.file);
}

writeFileSync(join(dir, "README.md"), readme, "utf8");
console.log("wrote README.md");
