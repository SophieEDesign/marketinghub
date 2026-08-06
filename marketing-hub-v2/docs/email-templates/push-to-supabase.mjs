/**
 * Push branded Auth email templates to the hosted Supabase project.
 *
 * Requires: SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)
 *
 * Usage:
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node docs/email-templates/push-to-supabase.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_REF = "hwtycgvclhckglmuwnmw";
const __dirname = dirname(fileURLToPath(import.meta.url));

function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "").trim();
}

function load(file) {
  return stripHtmlComments(readFileSync(join(__dirname, file), "utf8"));
}

const payload = {
  mailer_subjects_invite: "You're invited to Peters & May Marketing Hub",
  mailer_templates_invite_content: load("invite-user.html"),

  mailer_subjects_confirmation: "Confirm your Marketing Hub email",
  mailer_templates_confirmation_content: load("confirm-signup.html"),

  mailer_subjects_magic_link: "Your Marketing Hub sign-in link",
  mailer_templates_magic_link_content: load("magic-link.html"),

  mailer_subjects_recovery: "Reset your Marketing Hub password",
  mailer_templates_recovery_content: load("reset-password.html"),

  mailer_subjects_email_change: "Confirm your new Marketing Hub email",
  mailer_templates_email_change_content: load("change-email.html"),

  mailer_subjects_reauthentication: "Confirm it’s you — Marketing Hub",
  mailer_templates_reauthentication_content: load("reauthentication.html"),
};

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN.\nCreate one at https://supabase.com/dashboard/account/tokens"
  );
  process.exit(1);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }
);

const text = await res.text();
if (!res.ok) {
  console.error(`Push failed (${res.status}):`, text.slice(0, 2000));
  process.exit(1);
}

const keys = Object.keys(payload);
console.log(`Pushed ${keys.length / 2} Auth email templates to ${PROJECT_REF}`);
for (const k of keys.filter((k) => k.startsWith("mailer_subjects_"))) {
  console.log(`  ✓ ${k}: ${payload[k]}`);
}
